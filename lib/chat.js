/*jslint nomen: true, plusplus: true, browser:true, unparam: true */
/*global require */
var jQuery = require('jquery');
var renderTex = require('./rendertex.js').renderTex;
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');

var io = require('./standalone/socket.io.js');

function Chat(twView, params) {
    "use strict";
    this.sockNs = io.connect(twView.portalRootUrl().replace(/(:\d+)?\/$/, ':8090/chat'));
    if (!params.roomName) {
        throw new Error("No roomName provided!");
    }
    twView.changeState('disconnected');
    twView.addMessage('system', 'Connecting...');

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

    // Generate a jQueried DOM element
    function el(name) {
        return $(document.createElement(name));
    }

    this.renderChatWindow = function () {
        if (this.jqChatBox) {
            // Already got one
            return;
        }
        this.jqChatBox = el('ul').addClass('chatbox');
        this.jqInputBox = el('textarea').attr('class', "chatinput").attr('placeholder', "Enter your message, shift-enter starts a new line but doesn't send.");
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
                : state === 'reconnecting' ? 'Attempting to reconnect...'
                    : state === 'failed' ? 'Server not found, giving up.'
                        : '');

        this.updateActions(
            state === 'connected' ? ['chat-end', 'chat-send']
                : state === 'failed' ? ['restart']
                    : ['gohome', '']
        );
    };

    this.addMessage = function (author, message) {
        var self = this;

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
    twView.locale['chat-send'] = "Send message";
    twView.locale['chat-end'] = "Finish chat session";
    twView.stateMachine(function updateState(curState, fallback) {
        switch (curState) {
        case 'initial':
            updateState.call(this, 'chat-connect', fallback);
            break;
        case 'chat-connect':
            chat = new Chat(twView, twView.parseQS(window.location));
            twView.jqInputBox.on('keypress', function (e) {
                if (e.which === 13 && !e.shiftKey) {
                    // Finish processing this event, then send message
                    window.setTimeout(
                        updateState.bind(this, 'chat-send', fallback),
                        0
                    );
                }
            });
            break;
        case 'chat-send':
            chat.sendMessage(twView.jqInputBox.val());
            twView.jqInputBox.val("");
            twView.jqInputBox.trigger('change');
            break;
        case 'chat-end':
            chat.disconnect();
            break;
        case 'page-unload':
            chat.disconnect();
            break;
        default:
            fallback(curState);
        }
    });

}(window, jQuery));
