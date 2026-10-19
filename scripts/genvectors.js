#!/usr/bin/env node
/**
  * Regenerate tests/answerchain-vectors.json from lib/answerchain.js.
  *
  * The client is the authority here: it is the end that writes an entry, so
  * the fixture records what it produces and the server's suite checks that it
  * agrees. Run it with "make vectors" after any deliberate change to the
  * encoding, and commit the result alongside ANSWERCHAIN.rst.
  *
  * Cases are written as JSON *source text* rather than as values, so that
  * "1.0" stays distinguishable from "1" - the one difference the client can't
  * see and the server can.
  */
"use strict";

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var ac = require('../lib/answerchain.js');

var OUT_PATH = path.join(__dirname, '..', 'tests', 'answerchain-vectors.json');

// A student uuid as quizlib generates one - version 4, variant 1, which is
// the shape a server should check for. Fixed here so the vectors are
// reproducible; a real one is random - see ANSWERCHAIN.rst 4.1
var UUID = '6f9619ff-8b86-4011-b42d-00c04fc964ff';

// A lecture URI as the dump keys one, which with the uuid says which chain a
// root belongs to - see ANSWERCHAIN.rst 4.1
var LECTURE = '/tutorials/dept1/tut1/12.json';

// An entry as quizlib writes one for a multiple-choice answer, which is what
// the queue holds apart from the fields the chain ignores
var ENTRY_JSON = JSON.stringify({
    answer_time: 1792403615,
    correct: false,
    practice: false,
    quiz_time: 1792403611,
    selected_answer: "2",
    student_answer: 2,
    uri: "https://tutor-web-app/lec/question-uri"
});

var CANONICAL = [
    ['null', 'null is n', 'null'],
    ['true', 'true is t', 'true'],
    ['false', 'false is f', 'false'],

    ['zero', 'no -0, no leading zeros', '0'],
    ['one', null, '1'],
    ['minus-one', null, '-1'],
    ['forty-two', null, '42'],
    ['minus-forty-two', null, '-42'],
    ['quiz-timestamp', 'a real answer_time', '1792403615'],
    ['max-int', '2^53 - 1, the largest we allow', '9007199254740991'],
    ['min-int', null, '-9007199254740991'],
    ['integral-float', '1.0 is the integer 1 to the client; the server must agree', '1.0'],
    ['negative-zero-float', null, '-0.0'],

    ['one-half', 'fractional, so 3dp fixed point', '1.5'],
    ['grade-after', 'a grade as the queue holds it', '5.25'],
    ['three-dp', 'exactly representable at 3dp', '0.125'],
    ['negative-fraction', null, '-2.75'],
    ['beyond-three-dp', 'committed to 3dp, so this rounds', '1.23456'],
    ['rounds-half-away-from-zero', 'not Math.round, not round()', '0.0005'],
    ['rounds-half-away-from-zero-negative', null, '-0.0005'],
    ['tiny-fraction', 'below 3dp, so it rounds to zero thousandths', '1e-9'],

    ['empty-string', null, '""'],
    ['ascii-string', null, '"hello"'],
    ['uri', 'the only string in an entry we do not generate', '"https://tutor-web-app/lec/question-uri"'],
    ['question-type', null, '"usergenerated"'],
    ['embedded-nul', 'length-prefixed, so nothing needs escaping', '"a\\u0000b"'],
    ['control-chars', null, '"\\t\\n\\r"'],
    ['json-metachars', null, '"{\\"a\\": 1}"'],

    ['empty-list', null, '[]'],
    ['int-list', null, '[1, 2, 3]'],
    ['ordering', 'an ordering as the queue holds it', '[3, 1, 2, 0]'],
    ['nested-list', null, '[[1], [2, [3]]]'],
    ['mixed-list', null, '[1, true, null, "a"]'],

    ['empty-dict', null, '{}'],
    ['one-key-dict', null, '{"a": 2}'],
    ['key-sort', 'keys sort ascending, whatever order they arrive in', '{"b": 1, "a": 2}'],
    ['key-sort-prefix', 'a shorter key sorts before a longer one it prefixes', '{"ab": 1, "a": 2}'],
    ['key-sort-case', 'upper case sorts before lower, as the bytes do', '{"a": 1, "A": 2}'],
    ['key-sort-underscore', '_ is 0x5f, so it sorts after upper case and before lower', '{"a_b": 1, "ab": 2, "aXb": 3}'],
    ['nested-dict', null, '{"a": {"b": {"c": 1}}}'],

    ['entry-multiple-choice', 'the shape the chain actually covers', ENTRY_JSON],
    ['entry-unanswered', 'answer_time deleted, not nulled', '{"quiz_time": 1792403611, "uri": "ut:q"}'],
    ['entry-null-answer', 'present-and-null, which is not the same as absent', '{"quiz_time": 1792403611, "student_answer": null, "uri": "ut:q"}']
];

var ERRORS = [
    ['two-to-the-53', 'the client could not represent this', '9007199254740992', 'number-range'],
    ['minus-two-to-the-53', null, '-9007199254740992', 'number-range'],
    ['oversized-float', null, '1e30', 'number-range'],
    ['oversized-nested', 'nested, where a careless implementation might not look', '{"a": [9007199254740992]}', 'number-range'],

    ['non-ascii-string', 'no UTF-8 in an entry, so no UTF-8 in the encoding', '"\\u00e6"', 'non-ascii-string'],
    ['non-ascii-string-astral', null, '"\\ud83d\\ude42"', 'non-ascii-string'],
    ['lone-surrogate', 'ill-formed and non-ASCII; one rule covers both', '"\\ud800"', 'non-ascii-string'],
    ['non-ascii-nested', null, '{"a": ["x", "\\u00e6"]}', 'non-ascii-string'],
    ['non-ascii-key', null, '{"\\u00e6": 1}', 'non-ascii-key'],
    ['non-ascii-key-nested', null, '{"a": {"\\u00e6": 1}}', 'non-ascii-key']
];

function hex(bytes) {
    return Buffer.from(bytes).toString('hex');
}

function sha256(bytes) {
    return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function canonicalVector(c) {
    var bytes = ac.canonical(JSON.parse(c[2]));

    return {
        name: c[0],
        note: c[1],
        value_json: c[2],
        canonical_hex: hex(bytes),
        sha256: sha256(bytes)
    };
}

function errorVector(c) {
    var code = null;

    try {
        ac.canonical(JSON.parse(c[2]));
    } catch (e) {
        code = e.code;
    }
    if (code !== c[3]) {
        throw new Error(c[0] + ': expected ' + c[3] + ', got ' + code);
    }
    return { name: c[0], note: c[1], value_json: c[2], error: c[3] };
}

function linkVector(name, note, prev, entry) {
    var bytes = ac.linkPreimage(prev, entry);

    return {
        name: name,
        note: note,
        prev: prev,
        entry: entry,
        preimage_hex: hex(bytes),
        link: sha256(bytes)
    };
}

function rootVector(name, note, uuid, lecture) {
    var bytes = ac.rootPreimage(uuid, lecture);

    return {
        name: name,
        note: note,
        uuid: uuid,
        lecture: lecture,
        preimage_hex: hex(bytes),
        root: sha256(bytes)
    };
}

function roots() {
    return [
        rootVector('student-lecture', 'what a first entry follows', UUID, LECTURE),
        rootVector(
            'other-lecture',
            'the same student in another lecture is another chain',
            UUID,
            '/tutorials/dept1/tut1/13.json'
        ),
        rootVector(
            'other-student',
            'another student in the same lecture, likewise',
            '00000000-0000-4000-8000-000000000000',
            LECTURE
        ),
        rootVector(
            'not-a-link',
            'a root preimage has different keys to a link one, so they cannot collide',
            '',
            ''
        )
    ];
}

function stripNulls(o) {
    // A note is optional, and an absent one shouldn't appear in the fixture
    if (o.note === null) {
        delete o.note;
    }
    return o;
}

function links() {
    var entry = JSON.parse(ENTRY_JSON),
        next = JSON.parse(ENTRY_JSON),
        derived = JSON.parse(ENTRY_JSON),
        studentRoot = roots()[0].root,
        root;

    next.answer_time = 1792403799;
    next.correct = true;
    next.quiz_time = 1792403750;
    next.uri = "https://tutor-web-app/lec/question-uri-2";

    // The fields _queueMerge rewrites and the ones derived from the queue.
    // NB: grade_after is encodable now it has a fixed-point form, but it is
    // still not chained - see ANSWERCHAIN.rst 2
    derived.synced = true;
    derived.lec_answered = 7;
    derived.lec_correct = 3;
    derived.grade_after = 1.5;
    derived.grade_next_right = 2.25;
    derived.explanation_delay = 12;
    derived.form_data = [{ name: 'answer', value: '2' }];
    // NB: prev_sha is the chain's own bookkeeping (ANSWERCHAIN.rst 4), and an
    // entry doesn't hash what it follows twice - the preimage has it already
    derived.prev_sha = studentRoot;

    root = linkVector('root', 'the first entry follows the student root', studentRoot, entry);
    return [
        root,
        linkVector('second', 'prev is the link before it', root.link, next),
        linkVector(
            'other-root',
            'the same entry in another lecture is a different link',
            roots()[1].root,
            entry
        ),
        linkVector(
            'ignores-unchained-fields',
            'same link as root, derived fields and all',
            studentRoot,
            derived
        )
    ];
}

var vectors = {
    comment: 'Generated by scripts/genvectors.js; the contract both implementations are tested against. See ANSWERCHAIN.rst.',
    version: 1,
    canonical: CANONICAL.map(canonicalVector).map(stripNulls),
    errors: ERRORS.map(errorVector).map(stripNulls),
    links: links().map(stripNulls),
    roots: roots().map(stripNulls)
};

fs.writeFileSync(OUT_PATH, JSON.stringify(vectors, null, 2) + '\n');
console.log(
    'Wrote ' + OUT_PATH + ': ' +
    vectors.canonical.length + ' canonical, ' +
    vectors.errors.length + ' error, ' +
    vectors.links.length + ' link, ' +
    vectors.roots.length + ' root vectors'
);
