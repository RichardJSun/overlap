# Overlap

Two-player co-op browser game made for WolfJam 2026. Jam theme: Visibility. Judged on creativity, documentation, theme, gameplay, and design (looks and sounds).

## What it is

A city in a blackout. Two players, two devices, one room code.

- **Runner** walks the dark streets with a red lantern and sees only what light reaches. Plays on a laptop with arrow keys or WASD, or taps to move.
- **Guide** sits in the utility control room, sees the whole map, drops pings (2 s cooldown), and switches colored streetlights within a power budget. Usually plays on a phone in portrait, joined by scanning a QR code from the Runner's screen.
- Light colors add: red + blue = magenta, red + green = yellow, green + blue = cyan. Bridges and doors exist only in the right mixed light; drones of a color are visible only in light that contains it.
- Each substation restores power to a block for good and raises the Guide's budget. The ending is the whole city lit, both screens showing the same view.
- `?local=1` runs both roles side by side on one screen for showcasing and development.

## Users and scenes

- Jam judges and players at a laptop, often in a dim room, sometimes on a projector.
- The Guide on a phone held in portrait (390 x 844 is the reference), thumbs only, glancing between the map and the partner.
- First contact is the title screen: decide a role, create or join a room in seconds.

## Product truth that constrains design

- Palette is fixed: night `#0b1020`, wall `#1b2238`, wall edge `#2c3758`, street `#141a2e`, warm powered glow `#ffd38a`, light red `#ff4d5e`, green `#4dff88`, blue `#4d8bff`, UI text `#e8ecff`. Mixed light colors come from additive mixing.
- All art and audio are generated in code. No external assets, fonts, CDNs, or image generation. System font stacks only.
- Colorblind support: every color has a glyph. Red = triangle, green = circle, blue = square; mixes overlay the shapes.
- Must respect reduced motion, keyboard reach on the title, 44 px touch targets, and no horizontal scroll at 360 px.

## Voice

Plain, short, municipal. The game talks like a dispatcher on a radio: what is happening and what to do next. No marketing language.
