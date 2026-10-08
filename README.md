# claude-term companion

An iOS/Android app for following and driving
[claude-term](https://github.com/RobCvdV/claude-term) sessions from a phone:
read the conversation, answer permission prompts, approve plans, and send new
prompts.

It exists because Anthropic's own Claude Code mobile view only covers sessions
billed to Anthropic models, and some of these sessions run other models through
the CLI.

## How it reaches the Mac

**Only over Tailscale.** The host binds its companion server to the tailnet
address and loopback and nothing else, so there is no relay, no cloud account,
and nothing on the local Wi-Fi can reach it. WireGuard provides the encryption.

Authentication is a challenge/response: the Mac sends a nonce, this app signs it
with an Ed25519 key generated on first launch and kept in the Keychain. **No
token or password is ever sent.** A captured signature is useless on the next
connection because the nonce is new.

## Pairing

On the Mac, ⌘K → **Pair a phone…** shows an address, a port and a code that is
good for two minutes and enrols exactly one device. Type those into the app's
pairing screen. The Mac then asks you to confirm the device by name before it is
trusted, and **Paired phones…** revokes any of them later.

### Several Macs

One device key enrols with as many Macs as you like — each stores the public half
separately — so pair every machine you run claude-term on. **Settings** lists
them, and tapping the host name in the Sessions header switches between them.

The phone talks to one Mac at a time: switching drops the socket to the old one
and dials the new. Pushes are unaffected, because a Mac pushes to the device
token it holds whether or not the socket is up — so every paired Mac can still
tell you a session wants you.

Forgetting a Mac only removes it from this list; the device key stays, because it
is the same key the other Macs trust. Revoke the phone on that Mac too, under
**Paired phones…**.

## What it can do

- list the Mac's live sessions, with what each is doing — the terminal's own
  "Tinkering…", the tool running and how long the turn has taken
- switch between several paired Macs
- follow a session's conversation, read from the session transcript and drawn
  as markdown
- answer a permission prompt: allow, allow-and-stop-asking, deny with a reason,
  or hand it back to the terminal — which is always still showing the same
  question
- approve a plan or send feedback on it
- answer a multiple-choice question
- send a new prompt, held automatically if the session is mid-dialog
- snapshot the terminal screen
- receive a push when a session starts waiting, finishes a long turn, or ends

## Running it

```bash
npm install
npx expo start          # then open in Expo Go, or a dev build
npm run typecheck
npm test
```

The wire protocol comes from
[claude-term-protocol](https://github.com/RobCvdV/claude-term-protocol), pinned
to a tag and shared with the host so the two cannot drift.

### Checking it against a real Mac

`lib/host.e2e.test.ts` drives this app's own client against a running
claude-term, which is the only way to know the handshake it sends is the one a
Mac accepts:

```bash
COMPANION_HOST=100.x.y.z COMPANION_PORT=50987 \
  COMPANION_KEY=~/.claude-term-companion.json \
  npx vitest run lib/host.e2e.test.ts
```

`COMPANION_KEY` points at a credentials file written by claude-term's own
`scripts/companion-client.mjs`, so an already-trusted device can be reused rather
than burning a fresh pairing code.

## Push notifications

The host only pushes to a device that handed it an Expo push token, so this is
opt-in: deny the notification permission and everything else still works. Getting
a token needs an EAS project id in `app.json`; without one the app runs fine and
simply never receives pushes.

Notification bodies are deliberately vague — a title and the folder name — because
a push travels through Expo and Apple. The command being asked about stays on the
tailnet until you open the app.
