# Key prompts

Overlap was built by AI coding agents (Claude Code) directed by Richard Sun. This file records the prompts that shaped the game.

1. **The handoff.** The full design and build plan in [HANDOFF.md](../HANDOFF.md) was given to the main session as its first message.
2. "Install project scoped skills here as needed. https://github.com/gamedev-skills/awesome-gamedev-agent-skills" — installed `phaser-core`, `game-feel`, `audio-design`, `level-design`, `puzzle`, `game-ui-ux`, `game-jam` into `.agents/skills`.
3. "We don't need to pin Phaser 3 ... We can treat the handoff loosely if needed." — moved to Phaser 4.2.
4. "Should the guide be able to see the players location?" led to the core rule that the Guide sees the Runner only on camera, under a lit streetlight or in a powered block, and the Runner can flare.
5. "Ok but with the color filter the problem is that our color and the light color is the same so its like kinda useless." led to the validator rule that the Runner's glass colors never share a channel with the city's streetlights.
6. "Also maybe we should have an opener before the game starts where you watch the city start to lose color" and "Isn't white made up of all the colors?" led to the opener where white streetlights split into red, green and blue and die, and the ending that reverses it.
7. "Why does it say white is every color at once? This dialogue is kinda dull also?" led to telling the story only through in-world calls and log lines.
8. "Also we can have like a little ringtone when the call comes in and then have our guy pick it up?" led to the bedroom cold open.
9. Stretch goals picked from a list: "Breaker Room" (the Guide fixes the main breaker's rule in CEL) and "Guide quick emotes" (Wait, Go, Flare?).
10. "our UI looks like slop bruh can we use the taste skill, emil design eng, and impeccable to fix it?" and "Can you create like mockups?" led to four HTML mockups and the redesign as a sheet of the city's wiring drawing.
