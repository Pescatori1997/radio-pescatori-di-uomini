/**
 * App-wide "sound on" preference for the continuous meditation player.
 *
 * TikTok/Reels behaviour: the videos start muted (so autoplay is allowed by the
 * browser/OS), but as soon as the user taps ONCE to enable audio, every next
 * meditation keeps playing with sound — without tapping again on each video.
 * Kept as a tiny module-level singleton shared by all video instances.
 */
let soundOn = false;

export const getSoundOn = () => soundOn;
export const setSoundOn = (v: boolean) => { soundOn = v; };
