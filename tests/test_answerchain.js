"use strict";
/**
  * Client half of the answer-chain canonical encoding tests. The vectors are
  * shared with tutorweb/quiz/tests/test_answerchain.py - if the two
  * implementations ever drift apart, one of these suites breaks. See
  * ANSWERCHAIN.rst.
  */
var crypto = require('crypto');
var fs = require('fs');

var ac = require('../lib/answerchain.js');

var VECTORS = JSON.parse(fs.readFileSync(__dirname + '/answerchain-vectors.json', 'utf8'));

function hex(bytes) {
    return Buffer.from(bytes).toString('hex');
}

function sha256(bytes) {
    return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function str(bytes) {
    // Canonical bytes are all ASCII now, so they are readable in a failure
    return Buffer.from(bytes).toString('latin1');
}

function errorCode(value) {
    try {
        ac.canonical(value);
    } catch (e) {
        return e.code;
    }
    return null;
}

/** Every canonical vector encodes to exactly the bytes in the fixture */
module.exports.testCanonicalVectors = function (test) {
    test.ok(VECTORS.canonical.length > 30, 'Vectors actually loaded');

    VECTORS.canonical.forEach(function (v) {
        // NB: Parsing value_json here, rather than the fixture holding the
        // parsed value, is what keeps 1.0 distinguishable from 1 for the
        // Python end - JSON round-tripping would lose it
        var value = JSON.parse(v.value_json), bytes;

        try {
            bytes = ac.canonical(value);
        } catch (e) {
            test.ok(false, v.name + ': threw ' + (e.code || e.message));
            return;
        }
        test.equal(hex(bytes), v.canonical_hex, v.name + ': canonical bytes');
        test.equal(sha256(bytes), v.sha256, v.name + ': sha256');
    });
    test.done();
};

/** Every error vector is refused, with the same code the server uses */
module.exports.testErrorVectors = function (test) {
    VECTORS.errors.forEach(function (v) {
        test.equal(errorCode(JSON.parse(v.value_json)), v.error, v.name + ': error code');
    });
    test.done();
};

/** Chain preimages and links match the fixture */
module.exports.testLinkVectors = function (test) {
    VECTORS.links.forEach(function (v) {
        var bytes = ac.linkPreimage(v.prev, v.entry);

        test.equal(hex(bytes), v.preimage_hex, v.name + ': preimage');
        test.equal(sha256(bytes), v.link, v.name + ': link');
    });
    test.done();
};

/** Root preimages and roots match the fixture */
module.exports.testRootVectors = function (test) {
    test.ok(VECTORS.roots.length > 3, 'Vectors actually loaded');

    VECTORS.roots.forEach(function (v) {
        var bytes = ac.rootPreimage(v.uuid, v.lecture);

        test.equal(hex(bytes), v.preimage_hex, v.name + ': preimage');
        test.equal(sha256(bytes), v.root, v.name + ': root');
    });
    test.done();
};

/** A root can't be mistaken for a link, whatever the uuid */
module.exports.testRootIsNotALink = function (test) {
    var uuid = '6f9619ff-8b86-4011-b42d-00c04fc964ff',
        lecture = '/tutorials/dept1/tut1/12.json';

    // Different keys in the two preimages, so nothing they name can make the
    // two collide
    test.notEqual(
        hex(ac.rootPreimage(uuid, lecture)),
        hex(ac.linkPreimage(uuid, { uri: lecture }))
    );
    test.notEqual(
        hex(ac.rootPreimage(uuid, lecture)),
        hex(ac.rootPreimage(uuid + 'x', lecture))
    );
    test.done();
};

/**
  * A root names a student and a lecture both, so neither this student's
  * other lectures nor another student's share a chain with this one
  */
module.exports.testRootSeparatesChains = function (test) {
    var uuid = '6f9619ff-8b86-4011-b42d-00c04fc964ff',
        other = '00000000-0000-4000-8000-000000000000',
        lecture = '/tutorials/dept1/tut1/12.json',
        entry = { uri: 'ut:q', quiz_time: 1792403611, answer_time: 1792403615 };

    Promise.all([
        ac.rootHash(uuid, lecture),
        ac.rootHash(uuid, '/tutorials/dept1/tut1/13.json'),
        ac.rootHash(other, lecture)
    ]).then(function (roots) {
        test.equal(new Set(roots).size, 3, 'three chains, three roots');

        // ...so the same first answer is a different link in each
        return Promise.all(roots.map(function (root) {
            return ac.linkHash(root, entry);
        }));
    }).then(function (links) {
        test.equal(new Set(links).size, 3, 'and three different links');
        test.done();
    });
};

/** linkHash() and rootHash() hash the preimages the vectors pin */
module.exports.testHashVectors = function (test) {
    Promise.all(VECTORS.links.map(function (v) {
        return ac.linkHash(v.prev, v.entry).then(function (link) {
            test.equal(link, v.link, v.name + ': linkHash');
        });
    }).concat(VECTORS.roots.map(function (v) {
        return ac.rootHash(v.uuid, v.lecture).then(function (root) {
            test.equal(root, v.root, v.name + ': rootHash');
        });
    }))).then(function () {
        // Lower-case hex, and the leading zero of a small byte isn't dropped
        return ac.linkHash('', { uri: 'ut:q' }).then(function (link) {
            test.ok(/^[0-9a-f]{64}$/.test(link), 'link is 64 hex digits: ' + link);
        });
    }).then(function () {
        test.done();
    });
};

/**
  * The chained fields are part of the specification, so changing them has to
  * be deliberate: ANSWERCHAIN.rst, both implementations and the vectors
  */
module.exports.testChainedFields = function (test) {
    test.deepEqual(ac.CHAINED_FIELDS, [
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
    ]);
    test.done();
};

/** The fields _queueMerge rewrites, or that are derived, are left out */
module.exports.testEntryFieldsIgnoresUnchained = function (test) {
    test.deepEqual(ac.entryFields({
        uri: 'ut:question0',
        quiz_time: 1792403611,
        synced: false,
        lec_answered: 7,
        lec_correct: 3,
        practice_answered: 1,
        practice_correct: 0,
        grade_after: 1.5,
        grade_next_right: 2.25,
        explanation_delay: 12,
        ordering_correct: [true, false],
        form_data: [{ name: 'answer', value: '2' }],
        prev_sha: 'f'.repeat(64)
    }), { uri: 'ut:question0', quiz_time: 1792403611 });
    test.done();
};

/** Deleting answer_time is not the same claim as nulling it */
module.exports.testNullIsNotAbsent = function (test) {
    var absent = ac.entryFields({ uri: 'ut:q', quiz_time: 1 }),
        present = ac.entryFields({ uri: 'ut:q', quiz_time: 1, answer_time: null });

    test.notEqual(hex(ac.canonical(absent)), hex(ac.canonical(present)));
    test.done();
};

/** An integral number is an integer, however it was written */
module.exports.testIntegralNumbers = function (test) {
    test.equal(str(ac.canonical(1)), 'i1e');
    test.equal(str(ac.canonical(1.0)), 'i1e');
    test.equal(str(ac.canonical(-0)), 'i0e');
    test.equal(str(ac.canonical(1792403615)), 'i1792403615e');
    test.equal(str(ac.canonical(ac.MAX_INT)), 'i9007199254740991e');
    test.done();
};

/** A fractional number is committed to 3dp, and rounds half away from zero */
module.exports.testFixedPointNumbers = function (test) {
    test.equal(str(ac.canonical(1.5)), 'm1500e');
    test.equal(str(ac.canonical(5.25)), 'm5250e');
    test.equal(str(ac.canonical(-2.75)), 'm-2750e');
    test.equal(str(ac.canonical(0.125)), 'm125e');

    // 3dp, so this much is kept and no more
    test.equal(str(ac.canonical(1.2344)), 'm1234e');
    test.equal(str(ac.canonical(1.23456)), 'm1235e');

    // Math.round(0.5) rounds towards +Infinity and Python's round() rounds to
    // even; neither end uses either, or they would disagree here
    test.equal(str(ac.canonical(0.0005)), 'm1e');
    test.equal(str(ac.canonical(-0.0005)), 'm-1e');
    test.equal(str(ac.canonical(0.0015)), 'm2e');
    test.equal(str(ac.canonical(-0.0015)), 'm-2e');

    // Below 3dp there is nothing left to commit to, and no -0
    test.equal(str(ac.canonical(1e-9)), 'm0e');
    test.equal(str(ac.canonical(-1e-9)), 'm0e');
    test.done();
};

/** Fixed point is not integer, so the two can't be confused */
module.exports.testFixedPointIsTaggedSeparately = function (test) {
    test.equal(str(ac.canonical(1500)), 'i1500e');
    test.equal(str(ac.canonical(1.5)), 'm1500e');
    test.done();
};

module.exports.testNumberRefusals = function (test) {
    test.equal(errorCode(ac.MAX_INT + 1), 'number-range');
    test.equal(errorCode(-(ac.MAX_INT + 1)), 'number-range');
    test.equal(errorCode(1e30), 'number-range');
    test.equal(errorCode(NaN), 'non-finite');
    test.equal(errorCode(Infinity), 'non-finite');
    test.equal(errorCode(-Infinity), 'non-finite');
    test.done();
};

/**
  * Strings are ASCII, so String.length is the byte length as well - the
  * mismatch between the two was the bug this encoding had to work around
  */
module.exports.testAsciiStrings = function (test) {
    test.equal(str(ac.canonical('')), 's0:');
    test.equal(str(ac.canonical('hello')), 's5:hello');
    test.equal(str(ac.canonical('ut:question0')), 's12:ut:question0');
    test.equal(
        str(ac.canonical('https://tutor-web-app/lec/question-uri')),
        's38:https://tutor-web-app/lec/question-uri'
    );
    // Length-prefixed, so nothing needs escaping
    test.equal(str(ac.canonical('a\u0000b')), 's3:a\u0000b');
    test.equal(str(ac.canonical('{"a": 1}')), 's8:{"a": 1}');
    test.done();
};

/** Anything above U+007F is refused rather than encoded */
module.exports.testNonAsciiRefused = function (test) {
    test.equal(errorCode('æ'), 'non-ascii-string');
    test.equal(errorCode(''), 'non-ascii-string');
    test.equal(errorCode('Hvað er 2 + 2?'), 'non-ascii-string');
    test.equal(errorCode('🙂'), 'non-ascii-string');
    // A lone surrogate needs no rule of its own: it isn't ASCII either
    test.equal(errorCode('\ud800'), 'non-ascii-string');
    test.equal(errorCode('a\udc00'), 'non-ascii-string');
    // ...and nested, where a careless implementation might not look
    test.equal(errorCode(['a', 'æ']), 'non-ascii-string');
    test.equal(errorCode({ a: { b: 'æ' } }), 'non-ascii-string');
    // A key is a string too, but says which rule it broke
    test.equal(errorCode({ 'æ': 1 }), 'non-ascii-key');
    test.done();
};

/** Key order in the object we're handed is irrelevant */
module.exports.testKeyOrderIrrelevant = function (test) {
    test.equal(
        str(ac.canonical({ zebra: 1, aardvark: 2, mongoose: 3 })),
        str(ac.canonical({ mongoose: 3, zebra: 1, aardvark: 2 }))
    );
    test.done();
};

/** Cases the shared JSON fixture can't express */
module.exports.testJavascriptOnlyRefusals = function (test) {
    test.equal(errorCode(undefined), 'unsupported-type');
    test.equal(errorCode(function () { return 1; }), 'unsupported-type');
    test.equal(errorCode(new Date()), 'unsupported-type');
    test.equal(errorCode({ a: undefined }), 'unsupported-type');
    test.equal(errorCode([1, undefined]), 'unsupported-type');
    test.done();
};
