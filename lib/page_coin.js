/*jslint nomen: true, plusplus: true, browser:true, unparam: true */
/*global require */
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');
var UserMenu = require('./usermenu.js');

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

    this.renderCoinAccount = function (data, captchaCallback) {
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
                    return el('tr').toggleClass('claimed', r.claimed).append([
                        el('td').text((new Date(r.time * 1000)).toLocaleString()),
                        el('td').text(r.lecture),
                        el('td').attr('class', 'numeric').text(r.amount / 1000),
                    ]);
                })),
                el('tfoot').append(el('tr').append([
                    el('th').attr('colspan', 2).attr('class', 'grand-total').text('Total:'),
                    el('th').attr('class', 'numeric').text(data.history.reduce(function (prev, cur) {
                        return (typeof prev === 'object' ? prev.amount : prev) + cur.amount;
                    }, 0) / 1000),
                    null
                ]))
            ]),
            null
        ]);
        if (data.coin_available <= 0) {
            self.jqQuiz.append([
                el('p').text('You have no more smileycoins to redeem.'),
                null
            ]);
        } else {
            self.jqQuiz.append([
                el('h3').text('Redeem coins'),
                el('img').attr('class', 'coinlogo').attr('src', 'smileycoin.png'),
                el('p').text('You have ' + withUnit(data.coin_available / 1000, 'smileycoin') + ' left to redeem. You have a maximum of 2 years before the offer expires.'),
                el('p').html('If you do not have a wallet yet to keep them in, you can get one <a href="http://tutor-web.info/smileycoin/download">from here</a>.'),
                el('p').html('Unused SMLY will be donated to the Education in a Suitcase project. You can also do this now by pressing the donate button below, which will be used to buy tablet computers for students in Kenya.'),
                el('label').text('Enter your wallet ID below to redeem them:'),
                el('input').attr('type', 'text')
                           .attr('class', 'wallet-id')
                           .attr('placeholder', 'e.g. TODO:')
                           .attr('value', data.walletId),
                $('<div class="g-recaptcha"></div>'),
                null
            ]);

            window.renderRecaptcha = function () {
                var rc = $('div.g-recaptcha')[0];

                window.grecaptcha.render(rc, {
                    'sitekey': '6LewMycUAAAAAHzxqiQNSJKZ8LIcsCC__9_rLcR_',
                    'callback': captchaCallback,
                });
            };
            // If already loaded, render. Otherwise wait.
            if (window.grecaptcha) {
                window.renderRecaptcha();
            }
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

    /** Return the wallet ID the user entered */
    this.getCaptchaResponse = function () {
        if (!window.grecaptcha || $('div.g-recaptcha > *').length === 0) {
            return null;
        }
        return window.grecaptcha.getResponse();
    };
}
CoinView.prototype = new View(jQuery);

(function (window, $) {
    "use strict";
    var quiz, twView, twMenu, walletAddr;

    // Do nothing if not on the right page
    if ($('body.page-coin').length === 0) { return; }

    // Wire up quiz object
    twView = new CoinView($);
    $.getScript("https://www.google.com/recaptcha/api.js?onload=renderRecaptcha&render=explicit");

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
            twMenu = new UserMenu($('#tw-usermenu'), quiz);
            twMenu.noop = 1; // NB: Keep JSLint quiet
            break;
        case 'coinaward-donate':
        case 'coinaward-redeem':
        case 'view-award':
            walletAddr = curState === 'coinaward-donate' ? '$$DONATE:EIAS' :
                         curState === 'coinaward-redeem' ? twView.getWalletId() :
                            null;

            quiz.updateAward(twView.portalRootUrl(), walletAddr, twView.getCaptchaResponse()).then(function (data) {
                if (data.coin_available > 0) {
                    twView.updateActions(['gohome', 'coinaward-donate', '']);
                } else {
                    twView.updateActions(['gohome']);
                }
                twView.renderCoinAccount(data, function () {
                    twView.updateActions(['gohome', 'coinaward-donate', 'coinaward-redeem']);
                });
            })['catch'](promiseFatalError);
            break;
        default:
            fallback(curState);
        }
    });
}(window, jQuery));
