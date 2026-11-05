// Thin wrapper around PeerJS. The host owns the simulation; guests send inputs
// and receive state snapshots. Rooms are short codes that map to peer ids.
(function () {
  const PREFIX = 'superwhiskers-v1-';
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const makeCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

  class Net {
    constructor(game) { this.game = game; this.role = null; this.peer = null; this.conns = []; this.conn = null; this.code = null; this.status = 'idle'; this.error = null; }
    get available() { return typeof Peer !== 'undefined'; }
    host(onReady) {
      this.role = 'host'; this.code = makeCode(); this.status = 'connecting';
      const peer = this.peer = new Peer(PREFIX + this.code, { debug: 0 });
      peer.on('open', () => { this.status = 'open'; onReady && onReady(this.code); });
      peer.on('connection', conn => this.accept(conn));
      peer.on('error', e => {
        if (e.type === 'unavailable-id') { peer.destroy(); this.host(onReady); return; }
        this.error = e.type || String(e); this.status = 'error';
      });
      peer.on('disconnected', () => { if (this.status !== 'closed') peer.reconnect(); });
    }
    accept(conn) {
      conn.on('open', () => { this.conns.push(conn); });
      conn.on('data', d => this.game.onGuestMessage(conn, d));
      conn.on('close', () => { this.conns = this.conns.filter(c => c !== conn); this.game.onGuestLeft(conn); });
      conn.on('error', () => { this.conns = this.conns.filter(c => c !== conn); this.game.onGuestLeft(conn); });
    }
    join(code, onOpen) {
      this.role = 'guest'; this.code = code.toUpperCase(); this.status = 'connecting';
      const peer = this.peer = new Peer({ debug: 0 });
      peer.on('open', () => {
        const conn = this.conn = peer.connect(PREFIX + this.code, { reliable: true });
        conn.on('open', () => { this.status = 'open'; onOpen && onOpen(); });
        conn.on('data', d => this.game.onHostMessage(d));
        conn.on('close', () => { this.status = 'closed'; this.game.onHostLeft(); });
        conn.on('error', () => { this.status = 'error'; this.game.onHostLeft(); });
      });
      peer.on('error', e => { this.error = e.type === 'peer-unavailable' ? 'ROOM NOT FOUND' : (e.type || String(e)); this.status = 'error'; });
    }
    // Debug: ?lag=120&jitter=40 delays every packet to rehearse a bad connection.
    deliver(c, msg) {
      const lag = Net.lag || 0, jit = Net.jitter || 0;
      const go = () => { if (c.open) { try { c.send(msg); } catch (e) { } } };
      if (lag > 0 || jit > 0) setTimeout(go, lag + Math.random() * jit); else go();
    }
    broadcast(msg) { for (const c of this.conns) this.deliver(c, msg); }
    send(msg) { if (this.conn) this.deliver(this.conn, msg); }
    close() { this.status = 'closed'; try { if (this.peer) this.peer.destroy(); } catch (e) { } this.peer = null; this.conns = []; this.conn = null; this.role = null; }
  }
  const q = new URLSearchParams(location.search);
  Net.lag = +q.get('lag') || 0; Net.jitter = +q.get('jitter') || 0;
  window.NET = { Net, makeCode, PREFIX };
})();
