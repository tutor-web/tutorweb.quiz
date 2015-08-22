/*jslint nomen: true, plusplus: true, browser:true, unparam: true */
/*global require */
var jQuery = require('jquery');
var Promise = require('es6-promise').Promise;
var renderTex = require('./rendertex.js').renderTex;
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');

var io = require('./standalone/socket.io.js');

function Chat(twView, roomName) {
    "use strict";
    this.sockNs = io.connect(twView.portalRootUrl().replace(/(:\d+)?\/$/, ':8090/chat'), {
        'transports': ['websocket', 'xhr-polling'],
    });
    if (!roomName) {
        throw new Error("No roomName provided!");
    }
    twView.changeState('connecting');

    // User-initiated actions

    this.sendMessage = function (message) {
        twView.addMessage('me', message);
        this.sockNs.emit("room_message", roomName, message);
    };

    this.disconnect = function () {
        this.sockNs.socket.disconnect();
    };

    // Network events

    this.sockNs.on('connect', function () {
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
        twView.addMessage('system', 'User ' + nick + ' has joined');
    });

    this.sockNs.on('room_leave', function (nick) {
        twView.addMessage('system', 'User ' + nick + ' has left');
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
    };

    this.renderTutorSettings = function (data) {
        this.jqQuiz.empty().append(el('form').append([
            el('h3').text('Update your tutor profile'),
            el('label').text('The name your potential pupils will see'),
            el('input').attr('type', 'text').attr('name', 'name').attr('value', data.name),
            el('label').text('The rate you will charge (SMLY/sec)'),
            el('input').attr('type', 'text').attr('name', 'rate').attr('value', data.rate),
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
            return this.jqQuiz.empty().append([
                el('h3').text('Choose a tutor to help you'),
                el('p').text('No tutors are available at the moment, try a different lecture or come back later'),
                null
            ]);
        }
        this.jqQuiz.empty().append([
            el('h3').text('Choose a tutor to help you'),
            this.selectList([[
                el('a').text("Tutors available now"),
                data.currentlyAvailable.map(function (t) {
                    return el('a')
                        .attr('href', self.generateUrl({roomName: t.chat_session}))
                        .append([
                            el('b').text(t.name + ': '),
                            t.details,
                            el('span').attr('class', 'grade').text(t.rate + ' SMLY / sec'),
                            null
                        ]);
                }),
            ]], unselectedActions, selectedActions),
            null
        ]);
    };

    this.changeState = function (state) {
        // state = 'connected|disconnected|'
        this.renderChatWindow();

        this.addMessage('system',
            state === 'connected' ? 'Connected, ready to chat.'
            : state === 'disconnected' ? 'Disconnected from server'
                : state === 'connecting' ? 'Attempting to connect...'
                    : state === 'reconnecting' ? 'Attempting to reconnect...'
                        : state === 'failed' ? 'Server not found, giving up.'
                            : '(state ' + state + ')');

        this.updateActions(
            state === 'connected' ? ['chat_end', 'chat_send']
                : state === 'reconnecting' ? []
                    : state === 'failed' ? ['restart']
                        : ['gohome', '']
        );
    };

    this.addMessage = function (author, message) {
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
            chat = undefined;
        }
        return ajaxApi.getJson(twView.portalRootUrl('@@quizdb-chat-tutor-settings')).then(function (data) {
            twView.renderTutorSettings(data);
            twView.updateActions(['gohome', 'chat_tutormenu_save']);
        });
    };

    twView.locale.chat_tutormenu_save = "Save and start tutoring";
    twView.states.chat_tutormenu_save = function () {
        return Promise.resolve().then(function () {
            return ajaxApi.postJson(twView.portalRootUrl('@@quizdb-chat-tutor-settings'), twView.formAsDict());
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
        window.location.hash = twView.selectListHref();
    };

    twView.locale.chat_connect = "Start chat session";
    twView.states.chat_connect = function () {
        return Promise.resolve().then(function () {
            return ajaxApi.postJson(twView.portalRootUrl('@@quizdb-chat-session-start'), { chat_session: twView.curUrl.roomName });
        }).then(function (data) {
            chat = new Chat(twView, twView.curUrl.roomName);
            twView.sendMessage = chat.sendMessage.bind(chat);
            twView.addMessage('system', 'Connecting as ' + data.user_role);
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
            chat.disconnect();
            chat = undefined;
        }
        return Promise.resolve().then(function () {
            return ajaxApi.postJson(twView.portalRootUrl('@@quizdb-chat-session-end'), { chat_session: twView.curUrl.roomName });
        }).then(function (data) {
            return "chat_return";
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
            chat = undefined;
        }
    };

    twView.stateMachine();
}(window, jQuery));
