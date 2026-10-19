/*jslint nomen: true, plusplus: true, browser:true */
/*global module, crypto, Uint8Array, Promise */
/**
  * Canonical encoding of an answerQueue entry, so that the device and the
  * server hash the same bytes. See ANSWERCHAIN.rst for the specification -
  * this file is one of its two implementations, and tests/test_answerchain.js
  * checks it against the shared vectors the other one is checked against.
  */
"use strict";

// The fields of an entry the chain covers: those the device writes and then
// never changes. See ANSWERCHAIN.rst section 2 for what's left out and why.
var CHAINED_FIELDS = [
    'allotted_time',
    'answer_time',
    'correct',
    'ordering',
    'practice',
    'question_id',
    'question_type',
    'quiz_time',
    'selected_answer',
    'student_answer',
    'uri'
];

// Beyond this, a double can't hold every integer, so the server could send
// us a number we're unable to represent - see ANSWERCHAIN.rst 1.1
var MAX_INT = 9007199254740991; // 2^53 - 1

// A fractional number is committed to 3 decimal places - see ANSWERCHAIN.rst 1.1
var SCALE = 1000;

function CanonicalError(code) {
    this.name = 'CanonicalError';
    this.code = code;
    this.message = 'tutorweb::error::Cannot encode answer: ' + code;
}
CanonicalError.prototype = new Error();

/** Push the bytes of (str) onto (out) - framing, so ASCII by construction */
function pushFraming(out, str) {
    var i;

    for (i = 0; i < str.length; i++) {
        out.push(str.charCodeAt(i));
    }
}

/**
  * Push the bytes of payload (str) onto (out), refusing anything that isn't
  * ASCII with (code).
  *
  * Entries are numbers and booleans apart from the question URI and the other
  * field values we generate ourselves, all of which are ASCII - so there is no
  * UTF-8 here at all, and none of the byte-length and surrogate disagreements
  * that came with it. See ANSWERCHAIN.rst 1.2 for what that costs.
  */
function pushPayload(out, str, code) {
    var i, c;

    for (i = 0; i < str.length; i++) {
        c = str.charCodeAt(i);
        if (c > 0x7F) {
            throw new CanonicalError(code);
        }
        out.push(c);
    }
}

function encodeNumber(out, value) {
    var scaled;

    if (!isFinite(value)) {
        // NaN and the infinities
        throw new CanonicalError('non-finite');
    }
    if (Math.floor(value) === value) {
        if (value > MAX_INT || value < -MAX_INT) {
            throw new CanonicalError('number-range');
        }
        // NB: String(-0) is '0', so zero only ever has the one encoding. An
        // integral double (JavaScript's 1.0) is an integer here, which is
        // what keeps it agreeing with Python's 1 - see ANSWERCHAIN.rst 1.1
        pushFraming(out, 'i' + String(value) + 'e');
        return;
    }

    // Fractional, so commit to 3dp. Rounding is half away from zero, done in
    // doubles: Math.round() and Python's round() disagree about halves, but
    // floor(abs(x) * 1000 + 0.5) is the same arithmetic in both.
    scaled = Math.floor(Math.abs(value) * SCALE + 0.5);
    if (value < 0) {
        scaled = -scaled;
    }
    if (scaled > MAX_INT || scaled < -MAX_INT) {
        throw new CanonicalError('number-range');
    }
    pushFraming(out, 'm' + String(scaled) + 'e');
}

function encodeString(out, value, code) {
    // NB: ASCII, so String.length is the byte length as well - the mismatch
    // between the two is the bug this encoding used to have to work around
    pushFraming(out, 's' + value.length + ':');
    pushPayload(out, value, code);
}

function encodeValue(out, value) {
    var i, keys;

    if (value === null) {
        pushFraming(out, 'n');
    } else if (value === true) {
        pushFraming(out, 't');
    } else if (value === false) {
        pushFraming(out, 'f');
    } else if (typeof value === 'number') {
        encodeNumber(out, value);
    } else if (typeof value === 'string') {
        encodeString(out, value, 'non-ascii-string');
    } else if (Array.isArray(value)) {
        pushFraming(out, 'l');
        for (i = 0; i < value.length; i++) {
            encodeValue(out, value[i]);
        }
        pushFraming(out, 'e');
    } else if (typeof value === 'object' && Object.prototype.toString.call(value) === '[object Object]') {
        // NB: Keys are ASCII, so this sort is a byte sort, which is what the
        // server does without having to byte-compare
        keys = Object.keys(value).sort();
        pushFraming(out, 'd');
        for (i = 0; i < keys.length; i++) {
            encodeString(out, keys[i], 'non-ascii-key');
            encodeValue(out, value[keys[i]]);
        }
        pushFraming(out, 'e');
    } else {
        // undefined, functions, Dates, class instances, ...
        throw new CanonicalError('unsupported-type');
    }
}

/** Canonical encoding of (value), as an array of byte values */
function canonical(value) {
    var out = [];

    encodeValue(out, value);
    return out;
}

/** The chained fields of (entry) that are actually present in it */
function entryFields(entry) {
    var i, out = {};

    for (i = 0; i < CHAINED_FIELDS.length; i++) {
        if (Object.prototype.hasOwnProperty.call(entry, CHAINED_FIELDS[i])) {
            // NB: Present-and-null is kept; absent stays absent. Deleting
            // answer_time is how quizlib marks a question as unanswered.
            out[CHAINED_FIELDS[i]] = entry[CHAINED_FIELDS[i]];
        }
    }
    return out;
}

/**
  * The bytes to hash for (entry), following on from (prev).
  *
  * Exposed separately from linkHash() because it is synchronous, which is
  * what lets the test vectors pin the bytes rather than just the digest.
  */
function linkPreimage(prev, entry) {
    return canonical({
        entry: entryFields(entry),
        prev: prev,
        v: 1
    });
}

/**
  * The bytes to hash for the root of a chain: (uuid) identifying whoever is
  * answering, (lectureUri) which of their chains it is.
  *
  * Both, because a chain is per student *and* per lecture - quizlib seals
  * within one lecture's queue. A root that named only the student would be
  * shared by every lecture, which would leave an anchor identifying no chain
  * in particular and a first entry free to move between them. See
  * ANSWERCHAIN.rst 4.1.
  *
  * A different set of keys to linkPreimage's, so a root can't collide with a
  * link however the two are chosen - see ANSWERCHAIN.rst 3
  */
function rootPreimage(uuid, lectureUri) {
    return canonical({
        lecture: lectureUri,
        root: uuid,
        v: 1
    });
}

/** A promise of the lower-case hex SHA-256 of (bytes) */
function hashHex(bytes) {
    return crypto.subtle.digest('SHA-256', new Uint8Array(bytes)).then(function (digest) {
        var i, out = '', digestBytes = new Uint8Array(digest);

        for (i = 0; i < digestBytes.length; i++) {
            out += (digestBytes[i] < 0x10 ? '0' : '') + digestBytes[i].toString(16);
        }
        return out;
    });
}

/**
  * The chain link for (entry) - a promise of its preimage's hash.
  * Asynchronous because crypto.subtle is.
  */
function linkHash(prev, entry) {
    return hashHex(linkPreimage(prev, entry));
}

/** The root of (uuid)'s chain in (lectureUri) - a promise, as above */
function rootHash(uuid, lectureUri) {
    return hashHex(rootPreimage(uuid, lectureUri));
}

module.exports.CHAINED_FIELDS = CHAINED_FIELDS;
module.exports.CanonicalError = CanonicalError;
module.exports.MAX_INT = MAX_INT;
module.exports.SCALE = SCALE;
module.exports.canonical = canonical;
module.exports.entryFields = entryFields;
module.exports.linkHash = linkHash;
module.exports.linkPreimage = linkPreimage;
module.exports.rootHash = rootHash;
module.exports.rootPreimage = rootPreimage;
