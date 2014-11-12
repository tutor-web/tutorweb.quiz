/*jslint nomen: true, plusplus: true, browser:true, unparam: true */
/*global require */
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqActions: <ul> that contains action buttons
  */
function CoinView($) {
    "use strict";

    // Generate a jQueried DOM element
    function el(name) {
        return $(document.createElement(name));
    }

    this.renderCoinAccount = function (data) {
        var self = this;

        function withUnit(val, unit) {
            return val + ' ' + unit + (val > 0 ? 's' : '');
        }

        self.jqQuiz.empty().append([
            el('h3').text('Coins earnt'),
            el('table').append([
                el('thead').append(el('tr').append([
                    el('th').text('Time'),
                    el('th').text('Lecture'),
                    el('th').text('Coins earnt'),
                ])),
                el('tbody').append(data.history.map(function (r) {
                    return el('tr').append([
                        el('td').text(r.time),
                        el('td').text(r.lecture),
                        el('td').attr('class', 'numeric').text(r.amount),
                    ]);
                })),
                el('tfoot').append(el('tr').append([
                    el('th').attr('colspan', 2).attr('class', 'grand-total').text('Total:'),
                    el('th').attr('class', 'numeric').text(data.history.reduce(function (prev, cur) {
                        return (typeof prev === 'object' ? prev.amount : prev) + cur.amount;
                    }, 0)),
                    null
                ]))
            ]),
            null
        ]);
        if (data.coin_available === 0) {
            self.jqQuiz.append([
                el('p').text('You have no more smileycoins to redeem.'),
                null
            ]);
        } else {
            self.jqQuiz.append([
                el('h3').text('Redeem coins'),
                el('p').text('You have ' + withUnit(data.coin_available, 'smileycoin') + ' left to redeem.'),
                el('label').text('Enter your wallet ID below to redeem them:'),
                el('input').attr('type', 'text')
                           .attr('class', 'wallet-id')
                           .attr('placeholder', 'e.g. TODO:')
                           .attr('value', data.walletId),
                null
            ]);
        }
        if (data.tx_id) {
            self.showAlert('info', 'Your coins have been transferred. Your transaction ID is: ' + data.tx_id);
        }
    };

    /** Return the wallet ID the user entered */
    this.getWalletId = function () {
        var jqWalletId = this.jqQuiz.find('input.wallet-id');
        return jqWalletId.length ? jqWalletId[0].value : null;
    };
}
CoinView.prototype = new View(jQuery);

(function (window, $) {
    "use strict";
    var quiz, twView;

    // Do nothing if not on the right page
    if ($('body.page-coin').length === 0) { return; }

    // Wire up quiz object
    twView = new CoinView($);

    // Start state machine
    twView.stateMachine(function updateState(curState, fallback) {
        function promiseFatalError(err) {
            setTimeout(function () {
                throw err;
            }, 0);
            throw err;
        }

        twView.updateActions([]);
        switch (curState) {
        case 'initial':
            // Create Quiz model
            quiz = new Quiz(localStorage, new AjaxApi($.ajax));
            updateState.call(this, 'view-award', fallback);
            break;
        case 'redeem-award':
        case 'view-award':
            quiz.updateAward(curState === 'redeem-award' ? twView.getWalletId() : null).then(function (data) {
                if (data.coin_available > 0) {
                    twView.updateActions(['gohome', 'redeem-award']);
                } else {
                    twView.updateActions(['gohome']);
                }
                twView.renderCoinAccount(data);
            })['catch'](promiseFatalError);
            break;
        default:
            fallback(curState);
        }
    });
}(window, jQuery));
