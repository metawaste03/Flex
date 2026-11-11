
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
    let t = 0, vol = 50, vid = null, st = -1, list = null, loop = false;
    const fire = (s) => { st = s; opts.events.onStateChange({ data: s }); };
    // Starting a video no tap started: with __blockAutoplay the browser only cues it.
    const startNew = () => setTimeout(() => { fire(-1); fire(window.__blockAutoplay ? 5 : 1); }, 10);
    // YouTube playlists: the player moves on to the next video by itself when one ends.
    self.loadPlaylist = (ids, i, s) => { __calls.push(['loadList', ids, i, s]); list = { ids, i: i || 0 }; vid = ids[list.i]; t = s || 0; startNew(); };
    self.cuePlaylist = (ids, i, s) => { __calls.push(['cueList', ids, i, s]); list = { ids, i: i || 0 }; vid = ids[list.i]; t = s || 0; setTimeout(() => fire(5), 10); };
    self.playVideoAt = (i) => { __calls.push(['playAt', i]); list.i = i; vid = list.ids[i]; t = 0; startNew(); };
    self.getPlaylistIndex = () => list ? list.i : -1;
    self.setLoop = (b) => { __calls.push(['loop', b]); loop = b; };
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
    // Loading a single video drops any playlist.
    const _load = self.loadVideoById, _cue = self.cueVideoById;
    self.loadVideoById = (v) => { list = null; _load(v); };
    self.cueVideoById = (o) => { list = null; _cue(o); };
    // __end(true): like real YouTube in a playlist, skip the "ended" event.
    window.__end = (noEnded) => {
      const L = list;
      if (!(noEnded && list)) fire(0);
      if (!list || list !== L) return;   // FLEX loaded something else on "ended"
      let n = list.i + 1;
      if (n >= list.ids.length) { if (!loop) return; n = 0; }
      list.i = n; vid = list.ids[n]; t = 0; __calls.push(['ytNext', n]);
      startNew();
    };
    window.__list = () => list && { ids: list.ids.slice(), i: list.i, loop: loop };
    window.__vid = () => vid;
    setTimeout(() => opts.events.onReady(), 5);
  } };
setTimeout(() => window.onYouTubeIframeAPIReady(), 0);