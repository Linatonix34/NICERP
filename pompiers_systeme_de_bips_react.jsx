import React, { useEffect, useState } from "react";

// APPLICATION COMPLÈTE DANS UN SEUL FICHIER
// - Page Login (code d'accès: "chef" / "equipier")
// - Page Chef: validation des inscriptions, gestion équipiers, affectation véhicules, envoi de tickets
// - Page Équipier: inscription (nom/prénom), affichage état, réception ticket + bip sonore 10s
// - Persistance via localStorage (simule backend)
// - Pas d'utilisation d'opérateurs récents (??, ?.) pour compatibilité

export default function PompiersFullApp() {
  // ----- constantes -----
  const CODES = { CHEF: "chef", EQUIPIER: "equipier" };

  // Rangs (pour chefs lors de l'acceptation)
  const RANKS = ["Sapeur", "Caporal", "Capitaine", "Chef"];
  const HIGH_RANKS = ["Capitaine", "Chef"];

  // ----- state initial (localStorage) -----
  const [users, setUsers] = useState(() => {
    const raw = localStorage.getItem("pf_users");
    return raw ? JSON.parse(raw) : [];
  });
  const [vehicles, setVehicles] = useState(() => {
    const raw = localStorage.getItem("pf_vehicles");
    return raw ? JSON.parse(raw) : [
      { id: 1, name: "VL - 12A", crew: [] },
      { id: 2, name: "FPT - 34B", crew: [] }
    ];
  });
  const [tickets, setTickets] = useState(() => {
    const raw = localStorage.getItem("pf_tickets");
    return raw ? JSON.parse(raw) : [];
  });
  // demandes d'inscription par les équipiers (en attente de validation par les chefs)
  const [pendingRegs, setPendingRegs] = useState(() => {
    const raw = localStorage.getItem("pf_pending");
    return raw ? JSON.parse(raw) : [];
  });

  // session basique (après login)
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("pf_session");
    return raw ? JSON.parse(raw) : { role: null, userId: null };
  });

  // UI locales
  const [route, setRoute] = useState(session.role ? (session.role === "chef" ? "chef" : "equipier") : "login");

  // formulaires
  const [loginCode, setLoginCode] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");

  // chef: pour envoi ticket
  const [ticketVehicleId, setTicketVehicleId] = useState(vehicles.length > 0 ? vehicles[0].id : null);
  const [ticketMessage, setTicketMessage] = useState("Accident — mobilisation requise");

  // logs
  const [log, setLog] = useState(() => {
    const raw = localStorage.getItem("pf_log");
    return raw ? JSON.parse(raw) : [];
  });

  // synchronisation localStorage
  useEffect(() => { localStorage.setItem("pf_users", JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem("pf_vehicles", JSON.stringify(vehicles)); }, [vehicles]);
  useEffect(() => { localStorage.setItem("pf_tickets", JSON.stringify(tickets)); }, [tickets]);
  useEffect(() => { localStorage.setItem("pf_pending", JSON.stringify(pendingRegs)); }, [pendingRegs]);
  useEffect(() => { localStorage.setItem("pf_session", JSON.stringify(session)); }, [session]);
  useEffect(() => { localStorage.setItem("pf_log", JSON.stringify(log)); }, [log]);

  // demander permission notifications
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") Notification.requestPermission().catch(function(){});
    }
  }, []);

  // helpers
  function pushLog(text) {
    var entry = { id: Date.now(), time: new Date().toISOString(), text: text };
    setLog(function(prev) { return [entry].concat(prev).slice(0, 500); });
  }
  function getUserById(id) { return users.find(function(u){ return u.id === id; }); }
  function getVehicleById(id) { return vehicles.find(function(v){ return v.id === id; }); }

  // Mise à jour automatique des crews dans vehicles
  useEffect(function(){
    setVehicles(function(prev){
      return prev.map(function(v){
        return Object.assign({}, v, { crew: users.filter(function(u){ return u.vehicleId === v.id; }).map(function(u){ return u.id; }) });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  // ---------- AUDIO ----------
  // bip long 10s (pour équipiers) — utilise WebAudio
  function playLongBip() {
    if (typeof window === "undefined") return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 750;
      gain.gain.value = 0.1; // volume raisonnable
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 10);
    } catch (e) {
      console.warn('Audio failed', e);
    }
  }

  // bip court (chef quand envoie ?) — 3 bips courts
  function playShortBips() {
    if (typeof window === "undefined") return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var t = ctx.currentTime;
      for (var i = 0; i < 3; i++) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.value = 0.08;
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t + i * 0.35);
        o.stop(t + i * 0.35 + 0.18);
      }
    } catch (e) { console.warn('Audio failed', e); }
  }

  // ---------- LOGIN ----------
  function submitLogin() {
    var code = (loginCode || "").trim().toLowerCase();
    if (code === CODES.CHEF) {
      setSession({ role: "chef", userId: null });
      setRoute("chef");
      pushLog('Connexion: Chef');
    } else if (code === CODES.EQUIPIER) {
      setSession({ role: "equipier", userId: null });
      setRoute("equipier");
      pushLog('Connexion: Equipier (page d\'inscription)');
    } else {
      alert('Code invalide — utilises "chef" ou "equipier"');
    }
  }

  // ---------- ÉQUIPIER : s'inscrire (création d'une demande) ----------
  function submitRegistration() {
    var first = (regFirstName || "").trim();
    var last = (regLastName || "").trim();
    if (!first || !last) { alert('Renseigne ton nom et prénom'); return; }
    var id = Date.now();
    var reg = { id: id, firstName: first, lastName: last, time: new Date().toISOString() };
    setPendingRegs(function(prev){ return [reg].concat(prev); });
    setRegFirstName(""); setRegLastName("");
    pushLog('Nouvelle demande inscription: ' + first + ' ' + last);
    alert('Demande envoyée — attends qu\'un chef valide ta demande');
    // rester sur la page équipier (attente)
  }

  // ---------- CHEF : accepter une inscription ----------
  function acceptRegistration(regId) {
    var reg = pendingRegs.find(function(r){ return r.id === regId; });
    if (!reg) return;
    var newId = users.length ? Math.max.apply(null, users.map(function(u){ return u.id; })) + 1 : 1;
    var newUser = { id: newId, name: reg.firstName + ' ' + reg.lastName, rank: RANKS[0], vehicleId: null, registeredAt: new Date().toISOString() };
    setUsers(function(prev){ return prev.concat([newUser]); });
    setPendingRegs(function(prev){ return prev.filter(function(r){ return r.id !== regId; }); });
    pushLog('Inscription acceptée: ' + newUser.name);
  }

  function rejectRegistration(regId) {
    setPendingRegs(function(prev){ return prev.filter(function(r){ return r.id !== regId; }); });
    pushLog('Inscription refusée (id ' + regId + ')');
  }

  // ---------- CHEF : affecter un équipier à un véhicule ----------
  function assignUserToVehicle(userId, vehicleId) {
    setUsers(function(prev){ return prev.map(function(u){ return u.id === userId ? Object.assign({}, u, { vehicleId: vehicleId }) : u; }); });
    var veh = getVehicleById(vehicleId);
    pushLog('Affectation: ' + getUserById(userId).name + ' -> ' + (veh ? veh.name : 'Aucun'));
  }

  // ---------- CHEF : envoyer un ticket ----------
  function sendTicket() {
    var vId = ticketVehicleId;
    var msg = (ticketMessage || '').trim();
    if (!vId || !msg) { alert('Sélectionne un véhicule et un message'); return; }
    var veh = getVehicleById(vId);
    var tgt = users.filter(function(u){ return u.vehicleId === vId; });

    var ticket = { id: Date.now(), vehicleId: vId, vehicleName: veh ? veh.name : '', message: msg, from: 'Chef', time: new Date().toISOString() };
    setTickets(function(prev){ return [ticket].concat(prev); });
    pushLog('Ticket envoyé: ' + ticket.message + ' -> ' + ticket.vehicleName + ' (' + tgt.length + ' équipiers)');

    // notifications + sons: pour chaque équipier affecté on envoie Notification (si permission) et on joue le bip long
    tgt.forEach(function(u){
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Ticket: ' + ticket.vehicleName, { body: ticket.message });
        }
      } catch (e) { console.warn('Notification failed', e); }
    });

    // son côté chef (court) et côté équipiers (long)
    playShortBips();
    // pour une approche simplifiée, on lance playLongBip globalement (si un équipier est connecté dans ce navigateur, il entendra)
    // mais dans un vrai système chaque poste serait séparé (backend + push notifications)
    if (tgt.length > 0) playLongBip();
  }

  // ---------- ÉQUIPIER : s'abonner aux tickets (simulation locale) ----------
  // Dans cette version locale on détecte tickets récents et on affiche/sonne si l'équipier est celui connecté
  useEffect(function(){
    if (session.role === 'equipier' && session.userId) {
      // chercher tickets non consultés
      var unhandled = tickets.filter(function(t){
        // si l'utilisateur est affecté au véhicule du ticket
        var u = getUserById(session.userId);
        return u && u.vehicleId === t.vehicleId;
      });
      if (unhandled.length > 0) {
        // jouer un bip long local (10s) pour simuler l'alerte
        playLongBip();
      }
    }
  }, [tickets, session]);

  // ---------- utilities UI / session management ----------
  function logout() { setSession({ role: null, userId: null }); setRoute('login'); pushLog('Déconnexion'); }

  // chef: se connecter en tant qu'utilisateur (optionnel)
  function chefImpersonate(userId) { setSession(function(prev){ return Object.assign({}, prev, { userId: userId }); }); pushLog('Chef: impersonation -> ' + getUserById(userId).name); }

  // equipier: si son inscription validée il peut se 'connecter' sur la page équipier
  function equipierConnectAs(userId) { setSession({ role: 'equipier', userId: userId }); pushLog('Equipier connecté -> ' + getUserById(userId).name); setRoute('equipier'); }

  // pour l'exemple, exposer une fonction utilitaire qui crée un utilisateur demo si la liste est vide
  useEffect(function(){
    if (users.length === 0) {
      var demo = [
        { id: 1, name: 'Jean Dupont', rank: 'Chef', vehicleId: 1, registeredAt: new Date().toISOString() },
        { id: 2, name: 'Marie Petit', rank: 'Capitaine', vehicleId: 1, registeredAt: new Date().toISOString() },
        { id: 3, name: 'Ali K.', rank: 'Sapeur', vehicleId: 2, registeredAt: new Date().toISOString() }
      ];
      setUsers(demo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- RENDER: 3 routes (login / chef / equipier) ----------
  // NOTE: on reste volontairement simple et inline pour facilité de lecture

  // Layout helpers
  function Header() {
    return (
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Pompiers — Système de Bips</h1>
        <div style={{ fontSize: 12, color: '#444' }}>Prototype local • Codes: chef / equipier</div>
      </header>
    );
  }

  // --- Login ---
  function LoginView() {
    return (
      <div style={{ padding: 12, background: 'white', borderRadius: 8 }}>
        <Header />
        <div style={{ marginTop: 8 }}>
          <label>Code d'accès (chef / equipier)</label>
          <div style={{ marginTop: 6 }}>
            <input value={loginCode} onChange={function(e){ setLoginCode(e.target.value); }} placeholder="Entrez le code" />
            <button onClick={submitLogin} style={{ marginLeft: 8 }}>Se connecter</button>
          </div>
        </div>
        <hr style={{ margin: '12px 0' }} />
        <div style={{ fontSize: 12 }}>
          <p>Si tu es équipier: choisis le code <b>equipier</b>, puis remplis le formulaire d'inscription.</p>
          <p>Si tu es chef: choisis le code <b>chef</b> pour valider les inscriptions et envoyer des tickets.</p>
        </div>
      </div>
    );
  }

  // --- Equipier view (avant validation et après) ---
  function EquipierView() {
    // si userId défini et utilisateur trouvé => affichage du tableau personnel
    var me = session.userId ? getUserById(session.userId) : null;

    if (!me) {
      // formulaire d'inscription + liste de ses demandes
      var myPending = pendingRegs.filter(function(r){ return false; }); // on ne stocke pas qui a demandé depuis ce navigateur
      return (
        <div style={{ padding: 12, background: 'white', borderRadius: 8 }}>
          <Header />
          <h3>Inscription Équipier</h3>
          <div>
            <input placeholder="Prénom" value={regFirstName} onChange={function(e){ setRegFirstName(e.target.value); }} />
            <input placeholder="Nom" value={regLastName} onChange={function(e){ setRegLastName(e.target.value); }} style={{ marginLeft: 8 }} />
            <button onClick={submitRegistration} style={{ marginLeft: 8 }}>Envoyer la demande</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: '#444' }}>Demandes en attente (visibles aux chefs)</div>
            <div style={{ marginTop: 8 }}>
              {pendingRegs.length === 0 ? <div style={{ color: '#777' }}>Aucune demande en attente</div> : (
                <ul>
                  {pendingRegs.map(function(r){ return <li key={r.id}>{r.firstName + ' ' + r.lastName + ' — ' + new Date(r.time).toLocaleString()}</li>; })}
                </ul>
              )}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={logout}>Retour / Déconnexion</button>
          </div>
        </div>
      );
    }

    // si me existe
    return (
      <div style={{ padding: 12, background: 'white', borderRadius: 8 }}>
        <Header />
        <h3>Bienvenue, {me.name}</h3>
        <div>Rang: {me.rank}</div>
        <div>Véhicule: {me.vehicleId ? (getVehicleById(me.vehicleId) ? getVehicleById(me.vehicleId).name : '—') : 'Non affecté'}</div>

        <div style={{ marginTop: 12 }}>
          <h4>Tickets récents</h4>
          <div style={{ maxHeight: 180, overflow: 'auto' }}>
            {tickets.length === 0 ? <div style={{ color: '#777' }}>Aucun ticket</div> : (
              <ul>
                {tickets.map(function(t){
                  // n'afficher que les tickets pour le véhicule où est affecté l'utilisateur
                  if (!me.vehicleId || t.vehicleId !== me.vehicleId) return null;
                  return <li key={t.id}><b>{t.vehicleName}</b> — {t.message} <span style={{ color: '#888' }}>({new Date(t.time).toLocaleString()})</span></li>;
                })}
              </ul>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={logout}>Déconnexion</button>
        </div>
      </div>
    );
  }

  // --- Chef view ---
  function ChefView() {
    return (
      <div style={{ padding: 12, background: 'white', borderRadius: 8 }}>
        <Header />
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h3>Demandes d'inscriptions</h3>
            <div style={{ maxHeight: 180, overflow: 'auto' }}>
              {pendingRegs.length === 0 ? <div style={{ color: '#777' }}>Aucune demande</div> : (
                <ul>
                  {pendingRegs.map(function(r){
                    return (
                      <li key={r.id} style={{ marginBottom: 8 }}>
                        {r.firstName + ' ' + r.lastName} — {new Date(r.time).toLocaleString()}
                        <div style={{ marginTop: 6 }}>
                          <button onClick={function(){ acceptRegistration(r.id); }}>Accepter</button>
                          <button onClick={function(){ rejectRegistration(r.id); }} style={{ marginLeft: 6 }}>Refuser</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <h3 style={{ marginTop: 12 }}>Équipiers</h3>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              {users.length === 0 ? <div style={{ color: '#777' }}>Aucun équipier</div> : (
                <ul>
                  {users.map(function(u){
                    return (
                      <li key={u.id} style={{ marginBottom: 6 }}>
                        <b>{u.name}</b> — {u.rank} — Véhicule: {u.vehicleId ? (getVehicleById(u.vehicleId) ? getVehicleById(u.vehicleId).name : '-') : 'Non affecté'}
                        <div style={{ marginTop: 6 }}>
                          <select value={u.vehicleId || ''} onChange={function(e){ assignUserToVehicle(u.id, e.target.value ? Number(e.target.value) : null); }}>
                            <option value="">Aucun</option>
                            {vehicles.map(function(v){ return <option key={v.id} value={v.id}>{v.name}</option>; })}
                          </select>
                          <button onClick={function(){ chefImpersonate(u.id); }} style={{ marginLeft: 8 }}>Se connecter comme</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

          </div>

          <div style={{ width: 360 }}>
            <h3>Envoi de ticket</h3>
            <div>
              <label>Véhicule</label>
              <div>
                <select value={ticketVehicleId || ''} onChange={function(e){ setTicketVehicleId(Number(e.target.value)); }}>
                  {vehicles.map(function(v){ return <option key={v.id} value={v.id}>{v.name}</option>; })}
                </select>
              </div>
              <label style={{ marginTop: 8 }}>Message</label>
              <div>
                <input value={ticketMessage} onChange={function(e){ setTicketMessage(e.target.value); }} style={{ width: '100%' }} />
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={sendTicket}>Envoyer ticket</button>
              </div>
            </div>

            <h3 style={{ marginTop: 12 }}>Journal</h3>
            <div style={{ maxHeight: 140, overflow: 'auto' }}>
              {log.length === 0 ? <div style={{ color: '#777' }}>Aucun événement</div> : (
                <ul>
                  {log.map(function(l){ return <li key={l.id} style={{ fontSize: 12 }}>{new Date(l.time).toLocaleString()} — {l.text}</li>; })}
                </ul>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <button onClick={logout}>Déconnexion</button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // --- MAIN RENDER ---
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 16, background: '#f3f4f6', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {route === 'login' ? <LoginView /> : null}
        {route === 'chef' ? <ChefView /> : null}
        {route === 'equipier' ? <EquipierView /> : null}
      </div>
    </div>
  );
}
