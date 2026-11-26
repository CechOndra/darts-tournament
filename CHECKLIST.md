# Things only you can verify

How this works: I add items here when something needs a human (ears, a real dartboard, a phone, a stopwatch).
Tell me the result ("1.2 works", "2.1: 4.5 s, 5 s, ...") and I tick the box, write the date and your note, and
act on it (e.g. change the estimator defaults). Items marked `[ ]` are open, `[x]` are verified, `[!]` failed
(then I fix it and reopen it as `[ ]`).

## 1. Audio (stage PC, sound on, after one click on the page)

- [ ] 1.1 Win song fades out over ~1.5 s when the loser's card draw starts (play a match to the end with Power Cards on)
- [ ] 1.2 Win song also fades over its last 3 s if no draw happens (finish a match with cards off, let the song run to the end)
- [ ] 1.3 A reopened match (undo the last dart) stops the song immediately
- [ ] 1.4 The same fade also works with a song uploaded in Admin > Settings > Stage Sounds

## 2. Real-life timings (give me numbers, I update the estimator defaults)

Use a phone stopwatch with 3-4 people (mix of beginners and better players). Write down every measurement, I
use the median and the spread. Current guesses are in brackets.

- [ ] 2.1 Seconds per dart: from picking up position at the oche to the dart landing, 10 visits per person (guess 4 s, sd 1.5)
- [ ] 2.2 Seconds per visit overhead: third dart lands until the next player's first dart leaves their hand, includes walking, pulling darts, score entry (guess 12 s, sd 4)
- [ ] 2.3 Seconds between legs, finish of one leg to first dart of the next (guess 45 s, sd 8)
- [ ] 2.4 Seconds between matches on one board: last dart to first dart of the next match, with the real tablet + stage (guess 180 s, sd 60)
- [ ] 2.5 Card draw: from the match-winning dart to the card drawn and looked at (guess 25 s, sd 8)
- [ ] 2.6 Playing a card during a match: seconds it adds, and how often teams play one per leg (guess 30 s, 30 % per team and leg)
- [ ] 2.7 How often something goes wrong (dart on the floor, argument, tablet problem) per 15 matches, and minutes lost (guess 5 % of matches, 4 min)

Measured values (fill in, then I rerun `npm run estimate` with them):

| What | Person / group | Values (s) |
|------|----------------|------------|
|      |                |            |

## 3. New features from the last sessions (not yet seen on real devices)

- [ ] 3.1 Nicknames show on the projector stage, matchup and FUT cards (not just in my local test)
- [ ] 3.2 Nicknames fit on a phone (guest page) and the scorer tablet
- [ ] 3.3 Friends' photos load from `local-data/players/players.json` through "Load mock dataset" and show on the phones without a deploy
- [ ] 3.4 Test tournament created on the real Supabase: switch, simulation buttons, and delete afterwards from the tournament list
- [ ] 3.5 A real (non-test) tournament shows no Test Tournament controls once matches have been played
- [ ] 3.6 Random Czech names and random icons look fine on the stage with 16 players (silhouette for no-photo players)
- [ ] 3.7 `npm run estimate` runs on your PC after `git pull` (needs Node 22.6+)

## 4. Older open items

- [ ] 4.1 Supabase `supabase/schema.sql` re-run for the Admin PIN (Dashboard > SQL Editor > New query > paste > Run), then try the PIN on the tablet
- [ ] 4.2 All devices on the same app version (the "new version, tap to reload" banner clears after one tap)
- [ ] 4.3 Full test night on tablet + PC stage + phones over Supabase, note everything that annoys you

## Done

(ticked items move here with the date and your note)
