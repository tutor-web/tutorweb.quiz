=========================================
Answer queue chain: canonical encoding v1
=========================================

An answerQueue entry is written on the student's device and verified on the
server, so both ends have to agree, byte for byte, on what an entry *is*
before either can hash it. This is that agreement. They keep it by sharing
one implementation rather than maintaining two: the server requires the
client's file.

It exists because the obvious approach - hashing the JSON - does not work
even with one implementation. ``JSON.stringify`` writes keys in the order
the object happens to have them, and the two copies of an entry are built
differently: the device fills one in a field at a time, while the copy it
chains onto later is whatever ``JSON.parse`` made of our reply. Two orders,
two hashes, one broken chain. Whitespace, how control characters are
escaped, and ``1`` versus ``1.0`` are the same kind of hazard, and none of
them are left to chance here.

What an entry actually holds keeps this small. The fields are numbers and
booleans, apart from the question URI and a few short values the device
generates itself, and all of those are ASCII. So there is no UTF-8 in this
encoding at all, and no floating point either: strings are ASCII and a
fractional number is fixed point to 3 decimal places. Anything else is
refused rather than guessed at.

Implementations:

* ``lib/answerchain.js`` - the encoding, and the only implementation of it
  (browser/Cordova, ES5)
* ``backend/chain.js`` - the server's use of it, which requires the file
  above rather than restating it. There was a second implementation, in
  Python, for a backend that is now in Node; nothing was lost by deleting it,
  because two implementations of a hash function are two things to keep in
  step and this is one.
* ``tests/answerchain-vectors.json`` - what the encoding produces, pinned.
  **A change to this document is only real once the vectors change with it.**
  They are also what a second implementation - a backend in another language,
  an auditor's script - would be held to.

This document specifies the encoding, the two preimages, and what the answer
queue stores. A root is derived, not issued: anyone who knows a student's
uuid can work one out, and section 4.1 says why that is enough. There is no
proof-of-work and no nonce either: adding one would change the preimage, and
so would mean a v2.


1. Canonical encoding
=====================

``canonical(value)`` produces a byte string, every byte of it ASCII: the
framing by construction, the string payloads by rule (1.2).

===============  =================================  =====================
Value            Encoding                           Example
===============  =================================  =====================
null             ``n``                              ``n``
false            ``f``                              ``f``
true             ``t``                              ``t``
integer          ``i`` decimal ``e``                 ``i-42e``
fixed point      ``m`` thousandths ``e``             ``m1500e``
string           ``s`` length ``:`` ASCII            ``s5:hello``
array            ``l`` items... ``e``                ``li1ei2ee``
object           ``d`` (key value)... ``e``          ``ds1:ai2ee``
===============  =================================  =====================

Every value is self-describing and every variable-length piece is
length-prefixed, so no escaping is involved anywhere and no two distinct
values share an encoding.

1.1 Numbers
-----------

A number whose value is integral encodes as ``i`` decimal ``e``: decimal
ASCII, with a leading ``-`` for negatives. No leading zeros, no ``+``, and
no ``-0``: zero is always ``i0e``.

The permitted range is -(2^53 - 1) to 2^53 - 1 inclusive. Outside it, raise
``number-range``. The limit is not arbitrary: JavaScript numbers are
doubles, so a server that emitted 2^53 + 1 would be sending the client a
value it cannot represent, and the two would hash different things.

NaN and the infinities raise ``non-finite``.

**Integral means integral in value, not in type.** ``1.0`` and ``1`` both
encode to ``i1e``. That costs nothing to honour here, JavaScript being unable
to tell the two apart in the first place - both are the same double, and
``JSON.parse('1.0')`` yields the number 1. It is written down for the
implementation that can tell them apart: ``json.loads('1.0')`` in Python is a
float, and an encoder that refused it, or encoded it differently, would be
rejecting entries the device thinks perfectly ordinary. Deciding on the value
rather than the type is the only rule two languages can both apply.

1.1.1 Fixed point
~~~~~~~~~~~~~~~~~

A number with a fractional part encodes as ``m`` thousandths ``e``: the
value multiplied by 1000 and rounded to an integer, so ``1.5`` is ``m1500e``
and ``-2.75`` is ``m-2750e``. The tag is not ``i``, so ``m1500e`` and
``i1500e`` stay distinct values. The scaled integer is subject to the same
range rule.

Three decimal places is the whole of the precision. ``1.23456`` encodes as
``m1235e``, and the link commits to the rounded value and nothing finer, so
a verifier comparing a stored number against a chained one has to round it
the same way first. The alternative - a canonical form for an arbitrary
double - means agreeing on the printed form of a binary fraction in two
languages, which is the class of disagreement this document exists to
prevent. The queue's fractional fields are grades; 3dp is more than they
need.

Rounding is **half away from zero**, computed as
``floor(abs(value) * 1000 + 0.5)`` with the sign put back afterwards. The
spelling matters: JavaScript's ``Math.round`` rounds a half towards
+Infinity, Python's ``round`` rounds it to even, and the two therefore
disagree about ``0.0005`` - while ``floor`` of the same double product is
the same integer in both. Anything below 0.0005 scales to zero
thousandths, which is ``m0e`` and never ``m-0e``.

1.2 Strings
-----------

``s`` then the length **in bytes** then ``:`` then those bytes, which MUST
be ASCII - every character below U+0080. A string containing anything else
raises ``non-ascii-string``.

Strings may hold anything within that, NUL and newlines included; there is
no escaping, because the length prefix already says where the string ends.

ASCII-only is a restriction the data allows: the strings in an entry are the
question URI, a question type, a form index - values we generate, none of
them free text. See section 2 for the one field where that is not yet true.

What it buys is the whole family of UTF-8 bugs, none of which can now
happen:

* **Length.** JavaScript's ``String.length`` counts UTF-16 code units, which
  equals the byte count exactly while a string is ASCII. Neither end has to
  encode anything to measure it, and they cannot produce ``s1:`` where the
  other expects ``s2:``.
* **Surrogates.** A lone surrogate is not ASCII, so the rule that refuses
  ``"æ"`` refuses it too. Neither end has to decide between U+FFFD, CESU-8
  and an exception, because neither end gets as far as encoding it.
* **Normalization.** There are no combining marks to normalize, so an
  NFC string and an NFD one cannot hash differently.

The cost is that a non-ASCII string is **refused, not encoded**. The failure
is a safe one rather than a silent one - both ends apply the same rule and
refuse the same entry, instead of hashing different bytes and failing
verification for a subset of students - so a field that turned out to need
UTF-8 would stop working loudly, not quietly. Adding UTF-8 strings back
would be a v2 (section 3), and the framing is already the right shape for
it, the length prefix being a byte count.

1.3 Objects
-----------

``d``, then each key immediately followed by its value, then ``e``. Keys are
encoded as strings, exactly as in 1.2.

* Keys are sorted by their bytes, ascending.
* Keys MUST be ASCII strings, as in 1.2. A non-ASCII key raises
  ``non-ascii-key`` rather than ``non-ascii-string``, so the message says
  which half of the object was wrong.

A non-string key is not a case: JavaScript object keys are strings, so
``Object.keys`` cannot hand the encoder anything else. An implementation in a
language where a dictionary takes other keys - Python, say - has to refuse
them, and the obvious code for that is ``non-string-key``.

Since keys are ASCII, nothing has to byte-compare to sort them: JavaScript's
default string sort is byte order for ASCII. Every key in an answerQueue
entry is a field name from the source, so the restriction costs nothing.

1.4 Anything else
-----------------

Any other type - ``undefined``, a function, a date, a class instance, a
``Buffer``, a ``BigInt`` - raises ``unsupported-type``. Entries are plain
JSON-shaped data; a ``Buffer`` off the wire or a ``BigInt`` out of a database
column is the call site's to convert, not this code's to guess at. A number
that arrives as something other than a number is especially not taken as
fixed point: what scale it came with is the caller's business.


2. The chained fields
=====================

The chain covers only the fields the student's device authors and then never
changes:

    ``allotted_time``, ``answer_time``, ``correct``, ``ordering``,
    ``practice``, ``question_id``, ``question_type``, ``quiz_time``,
    ``selected_answer``, ``student_answer``, ``uri``

``entry_fields(entry)`` keeps those of these keys that are **present** in
the entry and drops everything else. Present-and-null is kept, as ``n``;
absent stays absent. The two are distinguishable, and deliberately so -
``delete a.answer_time`` is how ``quizlib.js`` marks a question as not yet
answered, which is a different claim from "answered at no particular time".

What is excluded, and why:

* ``lec_answered``, ``lec_correct``, ``practice_answered``,
  ``practice_correct`` - ``_queueMerge`` (``quizlib.js:581``) recomputes
  these on *every* entry at *every* sync, including entries the server
  already returned. A hash covering them would break on the next sync.
* ``grade_after``, ``grade_next_right``, ``explanation_delay``,
  ``ordering_correct`` - derived from the queue or from the question's own
  answer data. The server can recompute them, so chaining them would only
  create a second place for them to disagree. A grade has a fixed-point
  encoding as of 1.1, so chaining one is now possible; it stays out for this
  reason and not for want of an encoding.
* ``synced`` - local bookkeeping; flips after a successful sync.
* ``form_data`` - the raw form, redundant with ``selected_answer`` and
  ``student_answer``, and the only field whose keys are not fixed by the
  source.

Two of these fields are shaped by question types that are on their way out,
and are worth knowing about until they are:

* ``student_answer`` is the integer index the student picked, which is what
  the vectors cover - except for template and usergenerated questions, where
  ``quizlib.js`` (``:409`` onwards) puts an object of student-written text in
  it instead. That text is not ASCII in general, so 1.2 refuses such an entry
  rather than chaining it. Usergenerated support is being dropped, which
  removes the case; until then those entries don't chain.
* ``question_id`` is only ever set on the usergenerated path
  (``quizlib.js:437``), so it will simply stop appearing in entries. It stays
  in the list because a field that is absent costs nothing - ``entry_fields``
  drops what isn't there.

Unlisted fields are ignored rather than rejected, so a later release can add
a derived field without invalidating chains already stored. The flip side is
that **an unchained field is not attested by the chain at all**, so the
server must not trust one. That is the right outcome regardless: the derived
fields are exactly the ones it should be recomputing.


3. The chain preimage
=====================

``link_preimage(prev, entry)`` is::

    canonical({
        "v":     1,
        "prev":  prev,            # hex hash of the previous link, or the
                                  # chain's root (section 4)
        "entry": entry_fields(entry),
    })

and the link itself is the lower-case hex SHA-256 of those bytes.

``root_preimage(uuid, lecture_uri)`` is the other one::

    canonical({
        "v":       1,
        "lecture": lecture_uri,   # which chain, section 4.1
        "root":    uuid,          # whose, section 4.1
    })

and a root is likewise the hex SHA-256 of those bytes. Its keys are a
different set from a link preimage's, so nothing a root names - however
chosen, however hostile - can produce bytes that are also a valid link
preimage. The two name spaces stay apart without either having to be
length-checked.

Everything goes inside one canonical object rather than being concatenated,
so there is no question of where one part ends and the next begins. ``v`` is
a domain tag: if this encoding ever changes, v2 preimages cannot collide
with v1 ones, and a mismatched implementation fails loudly instead of
hashing something plausible.

``v`` is still 1 even though the encoding above has changed, because nothing
had computed a link when it did: there is no v1 in the wild to distinguish
from. Once anything stores a link, a change to section 1 means ``v`` 2 and a
new set of vectors beside the old ones.

``linkHash`` and ``rootHash`` go straight from an entry or a uuid to its
digest, and are asynchronous because ``crypto.subtle.digest`` is. The server
hashes the same preimages synchronously instead - a sync is a handful of
them, and it is not a browser - which is what ``linkSha`` and ``rootSha`` in
``backend/chain.js`` are. The preimages are exposed either way, so the
vectors can pin the bytes and not only the digest.


4. In the answer queue
======================

``quizlib.js`` seals an entry in ``_sealAnswers``, called from
``getNewQuestion``: the student has moved on, so the device is finished with
the fields section 2 covers, and what the entry follows can be written down
once and for all::

    a.prev_sha = '<the link of the entry before it, or the chain's root>'

That is the whole of it, and it is a field of the entry like any other. An
entry's own link is not stored, being derivable from its ``prev_sha`` and its
contents, and the place it is actually needed is the *next* entry's
``prev_sha``. ``prev_sha`` is not itself a chained field, so an entry does not
hash what it follows twice - section 3's preimage has it already, and section
2's rule about unlisted fields keeps it out of the entry.

The commitment to an entry's contents is therefore made by its successor,
whose ``prev_sha`` is a hash of them. Nothing commits to the last entry of a
chain until another one follows it. That costs nothing: an unsynced entry is
the device's to rewrite either way, and a stored link would have been
rewritten with it.

Only unsynced entries are sealed. A synced one is the server's copy of
itself, and re-attesting it would mean hashing fields the device no longer
owns.

4.1 The student root
--------------------

An entry with nothing to follow - the first answer, or one whose predecessor
was never sealed - takes its chain's root as its ``prev_sha``: the
``root_sha`` the lecture carries, or ``root_hash(uuid, lecture_uri)`` worked
out locally for a lecture nothing has told us about yet.

**A root names the student and the lecture both**, because a chain does. A
root naming only the student would be shared by every lecture that student
touches, and then a first entry would verify equally well as the first entry
of any of their lectures - the lecture appears nowhere else in the preimage,
``entry.uri`` naming the question - so moving one between chains would be
undetectable. A root that names both identifies exactly one chain, and costs
a key in one preimage.

What this does not give is any order *between* a student's lectures. Each
chain attests its own sequence; nothing attests which came first, bar
``answer_time``, which is the device's clock. That would need one chain per
student, which is a different trade - see the note at the end of 4.2.

The device's clock is at least anchored: ``registerStudent`` sends a reading
of it and keeps what the server returns beside the server's own, so every
later ``quiz_time`` and ``answer_time`` has one pair of readings to be
compared against. The times themselves are chained, so a device cannot
rewrite them after the fact - but they are still its own clock's, and this
is what makes them mean anything to anyone else.

The root rides on the lecture rather than beside the registration, which is
both where it belongs - one root per chain, one chain per lecture - and free:
``syncLecture`` already copies the keys a reply carries onto the lecture, and
``removeUnusedObjects`` already throws a lecture's root away with the
lecture. It is a field of the lecture like any other; there is nothing to go
beside it, now that nothing signs it.

What we were told wins deliberately, though the two are the same value: the
server's root is the one a sync will be checked against, so there is no sense
in preferring our own arithmetic to it. Deriving is for a lecture nothing has
told us about yet. The client does not compare the two either: a server that
disagreed with us about our own root would be caught at the next sync, where
a first entry whose ``prev_sha`` isn't the root the server computes is a
``chain-mismatch`` naming both values - a better diagnostic than anything the
client could produce, from the end that has to be convinced.

The uuid itself is a version 4 UUID, and the **server** makes it: the client
registers saying only when it is doing so, and the identity it will answer
under comes back in the reply (``crypto.randomUUID()`` in
``backend/store.js``). So there is one place an identity can come from, and a
client cannot pick its own - which is also what lets the root be signed
server-side one day, there being nothing to sign for a name the client chose
for itself. It lives in ``ajaxapi.js``, next to the auth token and for the
same reason - that is the code which sends it, as ``X-Student-Uuid`` on every
request that has one to send - and ``registerStudent()`` writes it into
``_student_uuid`` in local storage as the reply arrives; ``studentUuid()``
only reads, and is null until then. A deployment with nobody to register
with (Plone, which knows who we are from the login) never gets one, and
seals nothing: an answer there is stored unattested, which is 4.2 below, and
the Plone backend ignores the field anyway. It has a key of its own because
``syncSubscriptions`` replaces the subscription table wholesale with the
server's copy, and ``removeUnusedObjects`` knows to keep it for the same
reason it keeps the token. It outlives a logout: forgetting a credential is
not forgetting who was answering.

It identifies **whoever is answering**, not the device they are answering on.
One per student rather than one per install, because a device can come to
hold several - a tablet a class shares, an app two people in a house use -
and those have to be separate chains however the hardware is divided up. A
student answering on two devices simply has two of these, which the server
can map to one student; a chain cannot be unpicked after the fact.

There is one of them today, under the one key. When there are several, the
key becomes per student and ``_studentUuid()`` takes an argument saying whose
it wants; nothing in sections 1 to 3 changes, because a root is a root.

What the root buys is separation: the same answers under two identities are
two different chains, and an entry lifted from one queue into another fails
on ``prev``. What it does not buy is authentication. The uuid has to reach
the server to be checked, and it sits in local storage, so anyone who can
read that storage or has seen one sync payload can mint a chain with that
root.


4.2 What the current backend does to this
-----------------------------------------

``backend/`` is a prototype of the replacement, and does the first two of
these; the rest are for whoever finishes it:

* ``parseAnswerQueue`` ignores keys it doesn't know, so ``prev_sha`` reaches
  the server intact, but the entries it sends *back* are rebuilt from the
  database (``sync/answers.py``) with ``prev_sha`` dropped - and without ``uri``,
  which is chained. So a chain survives locally only until the next sync, and
  a returned entry cannot be re-verified. Recomputing each link on the way in,
  storing it, and echoing ``prev_sha`` back out is what makes the chain worth
  having. A verifier must always recompute: the device's ``prev_sha`` says
  what an entry claims to follow, and only the server's own record says what
  it did.
* The uuid now rides on every request as ``X-Student-Uuid``, and
  ``registerStudent`` posts it to ``/register`` to collect the settings a
  seeded lecture has none of. The Plone backend ignores both, which is
  harmless; ``backend/`` reads them, and refuses a sync from a uuid that has
  not registered.
* An answer that is synced before the student asks for another question is
  never sealed, so chains restart at that point. Sealing on the way into a
  sync as well would close that gap.


5. Test vectors
===============

``tests/answerchain-vectors.json`` holds four groups of cases: ``canonical``
(a value and the bytes it encodes to), ``errors`` (a value and the code it is
refused with), ``links`` (a prev, an entry, and the link they make) and
``roots`` (a uuid and the root it derives). Bytes are given as lower-case hex
plus their SHA-256 - hex rather than a readable string because the canonical
form can contain control bytes, and because it leaves no room for a fixture
that is itself ambiguous.

``scripts/genvectors.js`` writes that file from ``lib/answerchain.js``, via
``make vectors``. With one implementation the fixture is not two ends
agreeing, it is this end being held to what it did yesterday: a change that
alters the bytes shows up as a diff in the vectors, where it can be looked at
and intended, rather than as chains that stop verifying. It is also the
contract a second implementation would be written against, which is why it
pins rules this one cannot get wrong - 1.1's ``1.0`` among them - as well as
ones it can.

The input is stored as ``value_json``, the JSON *source text*, which each
suite parses itself. That is not an accident: if the fixture held a parsed
value, writing it back out would turn ``1.0`` into ``1``, and the vector that
exists to pin the float rule would quietly stop saying anything.

Two suites read the same file:

* ``tests/test_answerchain.js`` (nodeunit, via ``make test``) - the encoding,
  the errors, the preimages, and ``linkHash``/``rootHash`` over them
* ``backend/test/chain.test.js`` (``node --test``) - the same vectors through
  the server's synchronous hashing, which is the one place the two ends do
  differ. It checks them against the client's asynchronous versions too, in
  case that difference ever becomes one that matters.

A few cases cannot be written in JSON at all - ``undefined``, NaN, the
infinities, a ``Buffer`` - and live in the JavaScript suite instead. The
``1.0`` vector is a no-op here by construction, JSON giving it the integer 1;
it is in the fixture for the implementation that would see a float.
