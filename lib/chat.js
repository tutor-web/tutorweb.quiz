/*jslint nomen: true, plusplus: true, browser:true, unparam: true */
/*global require */
var crel = require('crel');
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');

var io = require('./standalone/socket.io.js');

function Chat(twView, roomName) {
    "use strict";
    this.sockNs = io.connect(twView.portalRootUrl().replace(/(:\d+)?\/$/, ':8090/chat'));
    twView.changeState('disconnected');
    twView.addMessage('system', 'Connecting...');

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

    this.sockNs.on('reconnect_failed', function () {
        twView.changeState('failed');
    });

    // Chat events

    this.sockNs.on('set_nick', function (nick, message) {
        twView.changeNick(nick);
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

    this.renderChatWindow = function () {
        if (this.chatBox) {
            // Already got one
            return;
        }
        this.chatBox = crel('ul', {class: "chatbox"});
        this.inputBox = crel('textarea', {class: "chatinput", placeholder: "Enter your message"});
        this.jqQuiz.empty().append([
            crel('h3', 'Chat time'),
            this.chatBox,
            this.inputBox,
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
                    : ['chat-end']
        );
    };

    this.changeNick = function (nick) {
        this.jqQuiz.find("h3").text("Chat time: Your are " + nick);
    };

    this.addMessage = function (author, message) {
        // Display message in box
        $(this.chatBox).append(crel('li', [
            crel('span', { class: "author " + author }, (author === 'system' ? '++' : author)),
            crel('span', { class: "message" }, message),
        ]));
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
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
    twView.stateMachine(function updateState(curState, fallback) {
        switch (curState) {
        case 'initial':
            updateState.call(this, 'chat-connect', fallback);
            break;
        case 'chat-connect':
            chat = new Chat(twView, 'test-room');
            break;
        case 'chat-send':
            chat.sendMessage(twView.inputBox.value);
            twView.inputBox.value = "";
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
