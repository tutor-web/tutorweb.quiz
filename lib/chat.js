/*jslint nomen: true, plusplus: true, browser:true, unparam: true */
/*global require */
var jQuery = require('jquery');
var renderTex = require('./rendertex.js').renderTex;
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');

var io = require('./standalone/socket.io.js');

function Chat(twView, params) {
    "use strict";
    this.sockNs = io.connect(twView.portalRootUrl().replace(/(:\d+)?\/$/, ':8090/chat'), {
        'transports': ['websocket', 'xhr-polling'],
    });
    if (!params.roomName) {
        throw new Error("No roomName provided!");
    }
    twView.changeState('connecting');

    // User-initiated actions

    this.sendMessage = function (message) {
        twView.addMessage('me', message);
        this.sockNs.emit("room_message", params.roomName, message);
    };

    this.disconnect = function () {
        this.sockNs.socket.disconnect();
    };

    // Network events

    this.sockNs.on('connect', function () {
        this.emit('join', params.roomName);
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
                window.setTimeout(this.sendMessageEvent.bind(this), 0);
            }
        });
        this.jqQuiz.empty().append([
            this.jqChatBox,
            this.previewTeX(this.jqInputBox),
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
    var chat, twView;

    // Do nothing if not on the right page
    if ($('body.page-chat').length === 0) { return; }

    // Wire up objects
    twView = new ChatView($);

    // Start state machine
    twView.states.initial = function () {
        return twView.curUrl.roomName ? 'chat_connect'
             : twView.curUrl.tutorMode ? 'chat_tutormenu'
                 : 'chat_studentmenu';
    };

    twView.locale.chat_connect = "Start chat session";
    twView.states.chat_connect = function () {
        chat = new Chat(twView, twView.curUrl);
        twView.sendMessage = chat.sendMessage.bind(chat);
    };

    twView.locale.chat_send = "Send message";
    twView.states.chat_send = function () {
        twView.sendMessageEvent();
    };

    twView.locale.chat_end = "Finish chat session";
    twView.states.chat_end = function () {
        chat.disconnect();
    };

    twView.states['page-unload'] = function () {
        chat.disconnect();
    };

    twView.stateMachine();
}(window, jQuery));
