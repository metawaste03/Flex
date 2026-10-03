
window.__calls = [];
window.YT = { PlayerState: { UNSTARTED:-1, ENDED:0, PLAYING:1, PAUSED:2, BUFFERING:3, CUED:5 },
  Player: function(id, opts){
    const self = this;
    const pv = opts.playerVars || {};
    if (pv.list) {   // playlist resolver instance
      __calls.push(['resolver', pv.list, pv.mute]);
      let ready = false;
      self.getPlaylist = () => ready ? (pv.list === 'PLgoodgoodgood' ? ['AAAAAAAAAA1','PRIVATEVID1','CCCCCCCCCC3'] : null) : null;
      self.destroy = () => __calls.push(['destroyed']);
      setTimeout(() => { opts.events.onReady(); setTimeout(() => { ready = true; if (pv.list !== 'PLgoodgoodgood') opts.events.onError({data:100}); }, 200); }, 5);
      return;
    }
    let t = 0, vol = 50, vid = null, st = -1;
    const fire = (s) => { st = s; opts.events.onStateChange({ data: s }); };
    self.loadVideoById = (v) => { __calls.push(['load', v]); vid = typeof v === 'string' ? v : v.videoId; t = typeof v === 'string' ? 0 : v.startSeconds; setTimeout(() => fire(1), 10); };
    self.cueVideoById = (o) => { __calls.push(['cue', o.videoId, o.startSeconds]); vid = o.videoId; t = o.startSeconds; setTimeout(() => fire(5), 10); };
    self.playVideo = () => { __calls.push(['play']); fire(1); };
    self.pauseVideo = () => { __calls.push(['pause']); fire(2); };
    self.stopVideo = () => { __calls.push(['stop']); t = 0; fire(5); };
    self.seekTo = (s) => { t = s; };
    self.getCurrentTime = () => st === 5 ? 0 : t;
    self.getDuration = () => vid ? (vid.startsWith('LONG') ? 4000 : 200) : 0;
    self.getVolume = () => vol; self.setVolume = (v) => { vol = v; __calls.push(['vol', v]); };
    self.isMuted = () => false; self.unMute = () => {};
    window.__advance = (s) => { t += s; };
    window.__setT = (s) => { t = s; };
    window.__end = () => fire(0);
    window.__vid = () => vid;
    setTimeout(() => opts.events.onReady(), 5);
  } };
setTimeout(() => window.onYouTubeIframeAPIReady(), 0);