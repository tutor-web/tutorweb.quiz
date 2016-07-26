/*jslint nomen: true, plusplus: true, browser:true, unparam: true, todo: true, regexp: true*/
/*global require, Promise */
var jQuery = require('jquery');
require('es6-promise').polyfill();
var renderTex = require('./rendertex.js').renderTex;
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');
var Timer = require('./timer.js');

var io = require('./standalone/socket.io.js');

function Chat(twView, roomName, userNick) {
    "use strict";
    var self = this;

    this.sockNs = io.connect(twView.portalRootUrl().replace(/(:\d+)?\/$/, ':8090/chat'), {
        'transports': ['websocket', 'xhr-polling'],
    });
    if (!roomName) {
        throw new Error("No roomName provided!");
    }
    twView.changeState('connecting');

    // User-initiated actions

    this.sendMessage = function (message) {
        if (!this.sockNs) {
            return;
        }
        twView.addMessage('me', message);
        this.sockNs.emit("room_message", roomName, message);
    };

    this.disconnect = function () {
        if (!this.sockNs) {
            return;
        }
        this.sockNs.socket.disconnect();
        this.sockNs = undefined;
    };

    this.startSession = function (remainingSeconds, maxSeconds) {
        if (!this.sockNs) {
            return;
        }
        this.sockNs.emit("session_start", roomName, remainingSeconds, maxSeconds);
        twView.startTimer(remainingSeconds, maxSeconds);
    };

    this.stopSession = function (remainingSeconds, maxSeconds) {
        if (!this.sockNs) {
            return;
        }
        twView.addMessage('system', 'Session ended');
        this.sockNs.emit("session_stop", roomName);
        twView.stopTimer();
        this.disconnect();
    };

    // Network events

    this.sockNs.on('connect', function () {
        this.emit('nick', userNick);
        this.emit('join', roomName);
        twView.changeState('connected');
    });

    this.sockNs.on('disconnect', function () {
        twView.changeState('disconnected');
    });

    this.sockNs.on('reconnecting', function () {
        twView.changeState('reconnecting');
    });

    this.sockNs.on('connect_failed', function () {
        twView.changeState('failed');
    });

    this.sockNs.on('reconnect_failed', function () {
        twView.changeState('failed');
    });

    // Chat events

    this.sockNs.on('set_nick', function (nick, message) {
        twView.addMessage('system', 'You are known as ' + nick);
    });

    this.sockNs.on('room_message', function (nick, message) {
        twView.addMessage(nick, message);
    });

    this.sockNs.on('room_join', function (nick) {
        twView.addMessage('system', nick + ' has joined');
    });

    this.sockNs.on('room_leave', function (nick) {
        twView.addMessage('system', nick + ' disconnected');
    });

    // Session events

    this.sockNs.on('session_start', function (remainingSeconds, maxSeconds) {
        twView.startTimer(remainingSeconds, maxSeconds);
    });

    this.sockNs.on('session_stop', function () {
        twView.addMessage('system', 'Session ended by other user');
        twView.stopTimer();
        self.disconnect();
    });
}

function ChatView($) {
    "use strict";
    var self = this;

    // Generate a jQueried DOM element
    function el(name) {
        return $(document.createElement(name));
    }

    this.sendMessageEvent = function () {
        if (this.sendMessage) {
            this.sendMessage(self.jqInputBox.val());
        }
        self.jqInputBox.val("");
        self.jqInputBox.trigger('change');
    };

    this.startTimer = function (remainingSeconds, maxSeconds) {
        if (!self.timer) {
            self.timer = new Timer($('#tw-timer span'));
        }
        self.timer.start(function () {
            self.addMessage('system', 'Out of time!');
            $("#tw-actions button[data-state=chat_end]").click();
        }, Math.round(remainingSeconds));
    };

    this.stopTimer = function () {
        if (!self.timer) {
            self.timer = new Timer($('#tw-timer span'));
        }
        self.timer.stop();
    };

    this.renderChatWindow = function () {
        if (this.jqChatBox) {
            // Already got one
            return;
        }
        this.jqChatBox = el('ul').addClass('chatbox');
        this.jqInputBox = el('textarea').attr('class', "chatinput").attr('placeholder', "Enter your message, shift-enter starts a new line but doesn't send.");
        this.jqInputBox.on('keypress', function (e) {
            if (e.which === 13 && !e.shiftKey) {
                // Finish processing this event, then send message
                window.setTimeout(self.sendMessageEvent.bind(self), 0);
            }
        });
        this.jqQuiz.empty().append([
            this.jqChatBox,
            this.previewTeX(this.jqInputBox),
        ]);
        this.jqInputBox.focus();
    };

    this.renderTutorSettings = function (data) {
        if (data.competencies.length === 0) {
            this.jqQuiz.empty().append([
                el('h3').text('Not ready to tutor any lectures'),
                el('p').text('You are not yet ready to tutor in any lectures.'),
                null
            ]);
            return;
        }
        this.jqQuiz.empty().append(el('form').append([
            el('h3').text('Update your tutor profile'),
            el('label').text('The name your potential pupils will see'),
            el('input').attr('type', 'text').attr('name', 'name').attr('value', data.name),
            el('label').text('The rate you will charge (SMLY/minute)'),
            el('input').attr('type', 'text').attr('name', 'rate').attr('value', Math.round(data.rate * (60.0 / 1000.0))),
            el('label').text('Your Smileycoin wallet student should transfer funds to'),
            el('input').attr('type', 'text').attr('name', 'wallet').attr('value', data.wallet),
            el('label').text('Any other details about your service (e.g. when you will be available)'),
            el('textarea').attr('name', 'details').text(data.details),
            el('label').text('Lectures you are allowed to teach in'),
            el('ul').append(data.competencies.map(function (lecPath) {
                return el('li').text(lecPath);
            })),
            null
        ]));
    };

    this.renderPupilMenu = function (data, unselectedActions, selectedActions) {
        if (data.currentlyAvailable.length === 0) {
            this.updateActions(unselectedActions);
            return this.jqQuiz.empty().append([
                el('h3').text('Choose a tutor to help you'),
                el('p').text('No tutors are available at the moment, try a different lecture or come back later'),
                null
            ]);
        }
        this.jqQuiz.empty().append(el('form').append([
            el('h3').text('Choose a tutor to help you'),
            this.selectList([[
                el('a').text("Tutors available now"),
                data.currentlyAvailable.map(function (t) {
                    return el('a')
                        .attr('href', self.generateUrl({roomName: t.chat_session}))
                        .append([
                            el('b').text(t.name + ': '),
                            t.details,
                            el('span').attr('class', 'grade').text(Math.round(t.rate * (60.0 / 1000.0)) + ' SMLY / min'),
                            null
                        ]);
                }),
            ]], unselectedActions, selectedActions),
            el('label').text('How long you would like your chat session to be (in minutes)'),
            el('input').attr('type', 'text').attr('name', 'duration').attr('value', data.duration || 15),
            null
        ]));
    };

    this.changeState = function (state) {
        // state = 'connected|disconnected|'
        this.renderChatWindow();

        this.addMessage('system', {
            'connected': 'Connected, ready to chat.',
            'disconnected': 'Disconnected from server',
            'connecting': 'Attempting to connect...',
            'reconnecting': 'Attempting to reconnect...',
            'failed': 'Server not found, giving up.',
        }[state]);

        this.updateActions({
            'connected': ['chat_end', 'chat_send'],
            'disconnected': ['gohome', 'chat_return'],
            'reconnecting': [],
            'failed': ['restart'],
        }[state] || ['gohome', '']);
    };

    this.addMessage = function (author, message) {
        if (!message) {
            return;
        }

        // When blurred, say how many messages have been left
        if (this.windowBlurred) {
            document.title = document.title.replace(/^\((\d+)\) |^/, function (unused, p1) {
                return '(' + (parseInt(p1 || 0, 10) + 1) + ') ';
            });
        }

        // Display message in box
        $(this.jqChatBox).append(el('li').append([
            el('span').attr('class', "author " + author).text(author === 'system' ? '++' : author),
            el('span').attr('class', "message parse-as-tex").text(message),
        ]));
        renderTex($, this.jqChatBox).then(function () {
            self.jqChatBox.scrollTop(self.jqChatBox[0].scrollHeight);
        });
    };
}
ChatView.prototype = new View(jQuery);

(function (window, $) {
    "use strict";
    var chat, twView, ajaxApi = new AjaxApi($.ajax);

    // Do nothing if not on the right page
    if ($('body.page-chat').length === 0) { return; }

    // Wire up objects
    twView = new ChatView($);

    // Start state machine
    twView.states.initial = function () {
        return twView.curUrl.roomName ? 'chat_connect'
             : twView.curUrl.lecUri ? 'chat_pupilmenu'
                 : 'chat_tutormenu';
    };

    // Redefine gohome state to close the chat window
    if (window.opener) {
        twView.locale.gohome = "Close tab";
        twView.states.gohome = function () {
            window.close();
        };
    }

    twView.locale.chat_tutormenu = "Update your tutor profile";
    twView.states.chat_tutormenu = function () {
        if (chat) {
            chat.disconnect();
        }
        return ajaxApi.getJson(twView.portalRootUrl('@@quizdb-chat-tutor-settings')).then(function (data) {
            twView.renderTutorSettings(data);
            if (data.competencies.length === 0) {
                twView.updateActions(['gohome']);
            } else {
                twView.updateActions(['gohome', 'chat_tutormenu_save']);
            }
        });
    };

    twView.locale.chat_tutormenu_save = "Save and start tutoring";
    twView.states.chat_tutormenu_save = function () {
        return Promise.resolve().then(function () {
            var dataOut = twView.formAsDict();

            dataOut.rate = dataOut.rate / (60.0 / 1000.0); // SMLY/min --> mSMLY/sec
            return ajaxApi.postJson(twView.portalRootUrl('@@quizdb-chat-tutor-settings'), dataOut);
        }).then(function (data) {
            window.location.hash = "#!roomName=" + data.chat_session;
        });
    };

    twView.locale.chat_pupilmenu = "Choose your tutor";
    twView.states.chat_pupilmenu = function () {
        return Promise.resolve().then(function () {
            return ajaxApi.postJson(twView.portalRootUrl('@@quizdb-chat-prospective-tutors'), { lec_uri: twView.curUrl.lecUri });
        }).then(function (data) {
            twView.renderPupilMenu(data, ['gohome', ''], ['gohome', 'chat_pupilmenu_choose']);
        });
    };

    twView.locale.chat_pupilmenu_choose = "Chat with this tutor";
    twView.states.chat_pupilmenu_choose = function () {
        return Promise.resolve().then(function () {
            return ajaxApi.postJson(twView.portalRootUrl('@@quizdb-chat-prospective-tutors'), {
                chat_session: twView.selectListHref().replace(/.*roomName=([^;]+).*/, '$1'),
                max_seconds: twView.formAsDict().duration * 60,
                lec_uri: twView.curUrl.lecUri,
            });
        }).then(function (data) {
            window.location.hash = twView.generateUrl({roomName: data.chat_session});
        });
    };

    twView.locale.chat_connect = "Start chat session";
    twView.states.chat_connect = function () {
        return Promise.resolve().then(function () {
            return ajaxApi.postJson(twView.portalRootUrl('@@quizdb-chat-session-start'), { chat_session: twView.curUrl.roomName });
        }).then(function (data) {
            chat = new Chat(twView, twView.curUrl.roomName, data.user_nick);
            twView.sendMessage = chat.sendMessage.bind(chat);
            twView.addMessage('system', 'Connecting as ' + data.user_role);

            if (data.user_role === 'pupil') {
                twView.addMessage('system', 'Please transfer ' + Math.round(data.smly_amount / 1000) + ' SMLY to ' + data.smly_wallet);
            }

            // Once a pupil connects with a time, propogate the clock to the tutor
            if (data.remaining_seconds) {
                chat.startSession(data.remaining_seconds, data.max_seconds);
            }
        })['catch'](function (err) {
            if (err.message.indexOf('Chat session already finished') > -1) {
                twView.showAlert('info', 'This chat session is finished.');
                twView.updateActions(['gohome', 'chat_return']);
            } else {
                throw err;
            }
        });
    };

    twView.locale.chat_send = "Send message";
    twView.states.chat_send = function () {
        twView.sendMessageEvent();
    };

    twView.locale.chat_end = "Finish chat session";
    twView.states.chat_end = function () {
        if (chat) {
            chat.stopSession();
        }
        return Promise.resolve().then(function () {
            return ajaxApi.postJson(twView.portalRootUrl('@@quizdb-chat-session-end'), { chat_session: twView.curUrl.roomName });
        }).then(function (data) {
            twView.updateActions(['chat_return']);
        });
    };

    twView.locale.chat_return = "Return";
    twView.states.chat_return = function () {
        if (twView.curUrl.lecUri) {
            window.location.hash = "#!lecUri=" + twView.curUrl.lecUri;
        } else {
            window.location.hash = "#!";
        }
    };

    twView.states['page-unload'] = function () {
        if (chat) {
            chat.disconnect();
        }
    };

    twView.stateMachine();

    window.onblur = function () {
        twView.windowBlurred = true;
    };

    window.onfocus = function () {
        twView.windowBlurred = false;
        document.title = document.title.replace(/^\(\d+\) /, '');
    };
}(window, jQuery));
