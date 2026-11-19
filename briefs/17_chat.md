# 17 — Early Chat Window · 2000s · film 101–107 s
**Looks like:** a desktop instant-messenger conversation window from the early 2000s — glossy gradient title bar,
bevelled buttons, a buddy avatar, a toolbar of little icons, a white conversation pane with coloured screen names and
timestamps, an input box and a Send button. **A fictional client of your own design** (name it yourself), with its own
palette and icons: do not imitate any real messenger's logo, mascot, colours, emoticons, window chrome or sounds.
**Layout:** the window fills the picture (a sliver of desktop wallpaper shows at the edges and when it shakes). The
conversation pane spans the full width, and inside it one message is a wide **animated GIF that runs edge to edge
across the picture** with its ground line on the road (y = 800): the pelican rides *inside the GIF*.
**The GIF (required):** "low frame rate, 256 colours, and visible dithering." Render the GIF's content (simple outdoor
scene + the pelican from `env.pose`) into a low-resolution buffer (≈ 250 px wide), reduce it to a fixed small palette
with **ordered (Bayer) dithering**, and scale it up without smoothing. Set `stutter: 10`. A file label under it
("pelican_bike.gif · 214 KB").
**Beats (required): "An animated GIF of the cycling pelican arrives … The window shakes on a strong beat, and
'Typing…' appears at the top."** Before t = 0 the message is an incoming-file bar filling up; **at t = 0 the GIF
arrives**. **On t = 2.0 the whole window shakes** (a few frames of sharp jitter — a "nudge"); at t = 2.5 a status line
under the title bar shows "… is typing…" with stepping dots; at t = 4.0 the reply pops in ("is that a PELICAN??").
Earlier lines of chat above the GIF set the scene, deadpan ("found this in the archive", "apparently it's ancient").
**Title card:** the conversation header under the title bar — big display name line carrying zh, with en and date as
the status message; all in period UI type (`K.FONT.chat`, `K.FONT.sans`).
**Before / after:** file transfer in progress → afterwards the GIF keeps looping its last moments, empty road.
**Music here:** polyphonic-ringtone melody with message blips as percussion.
