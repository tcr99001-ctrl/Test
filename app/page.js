'use client';

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, onSnapshot, collection, updateDoc, deleteDoc, getDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Play, Eye, EyeOff, Users, CheckCircle2, Crown, 
  Sword, Shield, ThumbsUp, ThumbsDown, AlertCircle, 
  Link as LinkIcon, Sparkles, Scroll, Skull, Activity, Lock
} from 'lucide-react';

// ==================================================================
// [필수] 사용자님의 Firebase 설정값 (그대로 유지)
// ==================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBPd5xk9UseJf79GTZogckQmKKwwogneco",
  authDomain: "test-4305d.firebaseapp.com",
  projectId: "test-4305d",
  storageBucket: "test-4305d.firebasestorage.app",
  messagingSenderId: "402376205992",
  appId: "1:402376205992:web:be662592fa4d5f0efb849d"
};

// --- [1] Firebase 초기화 ---
let firebaseApp;
try {
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApps()[0];
  }
} catch (e) { console.error("Firebase Init Error:", e); }

const db = firebaseApp ? getFirestore(firebaseApp) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;

// --- [2] 게임 룰 & 유틸리티 (로직 유지) ---
const QUEST_RULES = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

function distributeRoles(count) {
  let good = [], evil = [];
  if (count === 5) { good=['멀린','시민','시민']; evil=['암살자','모르가나']; }
  else if (count === 6) { good=['멀린','퍼시벌','시민','시민']; evil=['암살자','모르가나']; }
  else if (count === 7) { good=['멀린','퍼시벌','시민','시민']; evil=['암살자','모르가나','오베론']; }
  else {
    good=['멀린','퍼시벌','시민','시민','시민']; evil=['암살자','모르가나','미니언'];
    while(good.length+evil.length < count) (good.length+evil.length)%2===0 ? good.push('시민') : evil.push('미니언');
  }
  const roles = [...good, ...evil];
  for(let i=roles.length-1; i>0; i--){
    const j=Math.floor(Math.random()*(i+1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return roles;
}

// --- [3] 메인 컴포넌트 ---
export default function AvalonGame() {
  const [user, setUser] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [error, setError] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);

  const isJoined = user && players.some(p => p.id === user.uid);
  const isHost = roomData?.hostId === user?.uid;

  // Init Logic
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if(p.get('room')) setRoomCode(p.get('room').toUpperCase());
    }
  }, []);

  useEffect(() => {
    if(!auth) return;
    const unsub = onAuthStateChanged(auth, u => {
      if(u) setUser(u);
      else signInAnonymously(auth).catch(console.error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if(!user || !roomCode || roomCode.length!==4 || !db) return;
    const unsubRoom = onSnapshot(doc(db,'rooms',roomCode), s => setRoomData(s.exists()?s.data():null));
    const unsubPlayers = onSnapshot(collection(db,'rooms',roomCode,'players'), s => {
      const list=[]; s.forEach(d=>list.push({id:d.id, ...d.data()}));
      setPlayers(list);
    });
    return () => { unsubRoom(); unsubPlayers(); };
  }, [user, roomCode]);

  // Presence Logic
  useEffect(() => {
    if(!isJoined || !roomCode || !user) return;
    const heartbeat = async () => { try { await updateDoc(doc(db,'rooms',roomCode,'players',user.uid), { lastActive: Date.now() }); } catch(e){} };
    heartbeat();
    const timer = setInterval(heartbeat, 5000);
    return () => clearInterval(timer);
  }, [isJoined, roomCode, user]);

  useEffect(() => {
    if(!isHost || !players.length) return;
    const cleaner = setInterval(() => {
      const now = Date.now();
      players.forEach(async p => {
        if(p.lastActive && now - p.lastActive > 15000) { try { await deleteDoc(doc(db,'rooms',roomCode,'players',p.id)); } catch(e){} }
      });
    }, 10000);
    return () => clearInterval(cleaner);
  }, [isHost, players, roomCode]);

  // Actions
  const handleCreate = async () => {
    if(!playerName) return setError("닉네임을 입력해주세요.");
    const code = Math.random().toString(36).substring(2,6).toUpperCase();
    await setDoc(doc(db,'rooms',code), {
      hostId: user.uid, status: 'lobby', phase: 'team_building',
      questScores: [null,null,null,null,null], currentQuestIndex: 0,
      leaderIndex: 0, votes: {}, questVotes: {}, currentTeam: [],
      createdAt: Date.now()
    });
    await setDoc(doc(db,'rooms',code,'players',user.uid), { name: playerName, joinedAt: Date.now(), lastActive: Date.now() });
    setRoomCode(code);
  };

  const handleJoin = async () => {
    if(!playerName || roomCode.length!==4) return setError("이름과 코드를 확인해주세요.");
    const snap = await getDoc(doc(db,'rooms',roomCode));
    if(!snap.exists()) return setError("존재하지 않는 방입니다.");
    await setDoc(doc(db,'rooms',roomCode,'players',user.uid), { name: playerName, joinedAt: Date.now(), lastActive: Date.now() });
  };

  const handleStart = async () => {
    if(players.length < 5) return setError("최소 5명의 기사가 필요합니다.");
    const roles = distributeRoles(players.length);
    const updates = players.map((p,i) => {
      const r = roles[i];
      const evil = ['암살자','모르가나','오베론','미니언','모드레드'].includes(r);
      return updateDoc(doc(db,'rooms',roomCode,'players',p.id), { role:r, isEvil:evil });
    });
    await Promise.all(updates);
    await updateDoc(doc(db,'rooms',roomCode), { 
      status: 'playing', questRules: QUEST_RULES[players.length], leaderIndex: 0 
    });
  };

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}?room=${roomCode}`;
    const el = document.createElement('textarea');
    el.value = inviteUrl;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopyStatus('link');
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const getMyData = () => {
    if(!user || !players.length) return null;
    const me = players.find(p=>p.id===user.uid);
    if(!me?.role) return null;
    let info = "";
    const evils = players.filter(p=>p.isEvil && p.role!=='오베론' && p.role!=='모드레드').map(p=>p.name).join(', ');
    const merlins = players.filter(p=>['멀린','모르가나'].includes(p.role)).map(p=>p.name).join(', ');
    
    if(me.role==='멀린') info=`악의 하수인: ${evils}`;
    else if(me.role==='퍼시벌') info=`멀린 후보: ${merlins}`;
    else if(me.isEvil && me.role!=='오베론') info=`동료 악당: ${evils}`;
    else info="당신은 충실한 아서왕의 신하입니다.";
    return { ...me, info };
  };
  const myData = getMyData();

  // Loading Screen
  if(!user) return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-slate-400 font-sans gap-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Sword size={20} className="text-blue-500 animate-pulse" />
        </div>
      </div>
      <p className="animate-pulse tracking-widest text-xs uppercase font-bold text-blue-500/50">System Initializing...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* --- UI: Ambient Background Effects --- */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] animate-pulse delay-700"></div>
      </div>

      <div className="relative mx-auto max-w-lg min-h-screen flex flex-col px-6 py-6">
        
        {/* --- UI: Header --- */}
        <header className="flex items-center justify-between mb-8 z-10">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative p-3 bg-slate-900 ring-1 ring-slate-800 rounded-xl">
                <Sword size={24} className="text-blue-500" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter leading-none bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">AVALON</h1>
              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-[0.3em] mt-1">Project Resistance</p>
            </div>
          </div>
          {isJoined && roomCode && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Session Code</span>
              <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg backdrop-blur-md">
                <span className="text-sm font-mono font-black text-blue-400 tracking-wider">{roomCode}</span>
              </div>
            </div>
          )}
        </header>

        {/* --- UI: Main Content --- */}
        <main className="flex-1 flex flex-col relative z-10">
          
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-4 backdrop-blur-sm">
              <AlertCircle className="text-rose-500 shrink-0" size={20} />
              <div>
                <h4 className="text-rose-500 font-bold text-sm">시스템 경고</h4>
                <p className="text-xs font-medium text-rose-200/80 mt-0.5">{error}</p>
              </div>
              <button onClick={()=>setError(null)} className="ml-auto text-rose-400 hover:text-white transition-colors">✕</button>
            </div>
          )}

          {/* 1. Lobby: Entrance */}
          {!isJoined && (
            <div className="my-auto space-y-10 animate-in fade-in zoom-in-95 duration-700">
              <div className="text-center space-y-4">
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-2xl">
                  아서 왕의<br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">원탁의 기사단</span>
                </h2>
                <p className="text-slate-400 text-sm font-medium">성스러운 임무와 배신이 공존하는 곳</p>
              </div>

              <div className="space-y-5 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5 backdrop-blur-xl shadow-2xl">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Knight Nickname</label>
                  <input 
                    value={playerName} 
                    onChange={e=>setPlayerName(e.target.value)} 
                    placeholder="당신의 이름을 입력하세요" 
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-5 py-4 text-lg font-bold text-white placeholder-slate-600 outline-none transition-all shadow-inner"
                  />
                </div>

                {!roomCode ? (
                  <>
                    <button 
                      onClick={handleCreate} 
                      className="group relative w-full overflow-hidden rounded-xl bg-blue-600 p-[1px] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#3182CE_50%,#E2E8F0_100%)]" />
                      <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-xl bg-slate-900 px-8 py-4 text-sm font-bold text-white backdrop-blur-3xl transition-all group-hover:bg-slate-800">
                        <Sparkles size={18} className="mr-2 text-blue-400" /> 새로운 원정대 결성
                      </span>
                    </button>

                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                      <div className="relative flex justify-center"><span className="bg-slate-950 px-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Or Join Session</span></div>
                    </div>
                  </>
                ) : null}

                <div className="flex gap-3">
                  <input 
                    value={roomCode} 
                    onChange={e=>setRoomCode(e.target.value.toUpperCase())} 
                    placeholder="CODE" 
                    maxLength={4}
                    className="flex-1 bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl text-center font-mono font-black text-xl uppercase outline-none transition-all shadow-inner tracking-widest"
                  />
                  <button 
                    onClick={handleJoin} 
                    className="flex-[1.5] bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold text-lg border border-slate-700 transition-all active:scale-[0.98] shadow-lg"
                  >
                    입장하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Lobby: Waiting Room */}
          {isJoined && roomData?.status === 'lobby' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500 h-full flex flex-col">
              
              {/* Stats Card */}
              <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6 shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={100} /></div>
                <div className="relative z-10 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Session Capacity</p>
                    <h2 className="text-4xl font-black text-white">{players.length} <span className="text-xl text-slate-600 font-medium">/ 10</span></h2>
                  </div>
                  {isHost && (
                     <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                       <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1"><Crown size={10}/> HOST</span>
                     </div>
                  )}
                </div>
                {/* Progress Bar */}
                <div className="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500" style={{width: `${(players.length/10)*100}%`}}></div>
                </div>
              </div>

              {/* Player List */}
              <div className="flex-1 overflow-hidden flex flex-col space-y-3">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={12}/> Connected Agents
                  </h3>
                  <button onClick={copyInviteLink} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors bg-indigo-500/10 px-2 py-1 rounded-md">
                    {copyStatus==='link' ? <><CheckCircle2 size={12}/> Copied</> : <><LinkIcon size={12}/> Invite Link</>}
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                  {players.map(p => (
                    <div key={p.id} className="group flex items-center justify-between p-3.5 bg-slate-900/40 border border-slate-800/50 hover:border-slate-700 hover:bg-slate-800/60 rounded-xl backdrop-blur-sm transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] ${p.id===roomData.hostId ? 'text-amber-500 bg-amber-500' : 'text-emerald-500 bg-emerald-500'}`}></div>
                        <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{p.name}</span>
                        {p.id===user.uid && <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold tracking-wider">YOU</span>}
                      </div>
                      {p.id===roomData.hostId && <Crown size={14} className="text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Host Controls */}
              <div className="pt-2 sticky bottom-0 z-20">
                {isHost ? (
                  <>
                    <button 
                      onClick={handleStart}
                      disabled={players.length < 5}
                      className="group relative w-full overflow-hidden rounded-2xl bg-white p-[1px] transition-all disabled:opacity-50"
                    >
                      <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#10B981_50%,#E2E8F0_100%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className={`inline-flex h-full w-full items-center justify-center rounded-2xl bg-slate-950 px-6 py-5 text-lg font-black text-white backdrop-blur-3xl transition-all ${players.length >= 5 ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:scale-[1.02]' : 'bg-slate-800'}`}>
                        <Play fill="currentColor" size={20} className="mr-3"/> 게임 시작
                      </span>
                    </button>
                    {players.length < 5 && <p className="text-center text-[10px] text-slate-500 font-bold mt-3 uppercase tracking-widest">Min 5 Players Required</p>}
                  </>
                ) : (
                  <div className="p-5 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 text-center backdrop-blur-sm">
                    <div className="flex justify-center mb-2"><div className="w-2 h-2 bg-slate-500 rounded-full animate-ping"></div></div>
                    <p className="text-xs font-bold text-slate-500">호스트가 게임을 시작하기를 기다리고 있습니다...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Game Play Phase */}
          {isJoined && roomData?.status === 'playing' && myData && (
            <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
              
              {/* Score Track */}
              <div className="relative py-4 px-2 bg-slate-900/40 rounded-3xl border border-slate-800/50 backdrop-blur-sm">
                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-800 -z-10"></div>
                <div className="flex justify-between items-center px-2">
                  {roomData.questScores.map((s,i) => (
                    <div key={i} className={`relative transition-all duration-500 ${i===roomData.currentQuestIndex ? 'scale-110' : 'scale-100 opacity-80'}`}>
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm border-[3px] shadow-xl transition-all duration-300 z-10
                        ${s===true ? 'bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-400 text-white shadow-blue-500/40' : 
                          s===false ? 'bg-gradient-to-br from-rose-500 to-red-600 border-rose-400 text-white shadow-rose-500/40' : 
                          i===roomData.currentQuestIndex ? 'bg-slate-900 border-amber-500 text-amber-500 shadow-amber-500/30 ring-4 ring-amber-500/10' : 
                          'bg-slate-800 border-slate-700 text-slate-500'}`}>
                        {s===true ? <Shield size={16} fill="currentColor"/> : s===false ? <Sword size={16} fill="currentColor"/> : i+1}
                      </div>
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-400 whitespace-nowrap bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-800">
                        {roomData.questRules[i]}명
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Identity Card (Reveal) */}
              <div 
                onClick={()=>setIsRevealed(!isRevealed)} 
                className={`group relative overflow-hidden cursor-pointer rounded-[2rem] border transition-all duration-500 select-none shadow-2xl
                  ${isRevealed 
                    ? (myData.isEvil 
                        ? 'bg-gradient-to-br from-rose-900 via-slate-900 to-black border-rose-500/50 shadow-rose-900/20' 
                        : 'bg-gradient-to-br from-blue-900 via-slate-900 to-black border-blue-500/50 shadow-blue-900/20') 
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'}`}
              >
                {/* Scanline Effect */}
                {isRevealed && <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_4px,6px_100%] pointer-events-none opacity-20"></div>}
                
                <div className="relative z-10 p-8 min-h-[180px] flex flex-col items-center justify-center text-center">
                  {isRevealed ? (
                    <div className="animate-in zoom-in duration-300 w-full">
                      <div className="flex justify-center mb-3">
                         {myData.isEvil ? <Skull size={32} className="text-rose-500 animate-pulse"/> : <Shield size={32} className="text-blue-500 animate-pulse"/>}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">Classified Info</p>
                      <h2 className={`text-4xl font-black tracking-tight mb-4 ${myData.isEvil ? 'text-transparent bg-clip-text bg-gradient-to-b from-rose-400 to-rose-600' : 'text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-600'}`}>
                        {myData.role}
                      </h2>
                      <div className={`text-xs font-medium leading-relaxed p-4 rounded-xl border backdrop-blur-md ${myData.isEvil ? 'bg-rose-950/30 border-rose-500/20 text-rose-200' : 'bg-blue-950/30 border-blue-500/20 text-blue-200'}`}>
                        {myData.info}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 opacity-60 group-hover:opacity-100 transition-all transform group-hover:scale-105">
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-700 shadow-inner group-hover:border-slate-500 transition-colors">
                        <Lock size={24} className="text-slate-400 group-hover:text-white transition-colors"/>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-300">Tap to Reveal Identity</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Eyes Only • Top Secret</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Bar: Leader */}
              <div className="flex items-center justify-center gap-3 py-3 px-6 bg-slate-900/80 border border-slate-800/80 rounded-full backdrop-blur-md shadow-lg mx-auto w-max">
                <Crown size={16} className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Current Leader</span>
                  <span className="text-sm font-black text-slate-200">{players[roomData.leaderIndex]?.name}</span>
                </div>
              </div>

              {/* === Phase Components === */}
              <div className="bg-slate-900/40 border border-slate-800/60 p-1 rounded-[2.5rem] backdrop-blur-xl">
                <div className="bg-slate-950/50 rounded-[2.3rem] p-6 border border-white/5">
                  {roomData.phase === 'team_building' && (
                    <TeamBuilding roomCode={roomCode} players={players} roomData={roomData} user={user} isLeader={players[roomData.leaderIndex]?.id===user.uid} />
                  )}
                  {roomData.phase === 'voting' && (
                    <Voting roomCode={roomCode} roomData={roomData} user={user} />
                  )}
                  {roomData.phase === 'quest' && (
                    <Quest roomCode={roomCode} roomData={roomData} user={user} myRole={myData.role} />
                  )}
                  {roomData.phase === 'assassin' && (
                     <div className="text-center space-y-6 py-8 animate-in zoom-in">
                       <div className="inline-flex p-6 bg-rose-500/10 rounded-full border border-rose-500/30 shadow-[0_0_30px_rgba(225,29,72,0.2)]">
                         <Skull size={48} className="text-rose-500" />
                       </div>
                       <div>
                         <h2 className="text-3xl font-black text-white uppercase tracking-tight">Assassin Phase</h2>
                         <p className="text-sm text-rose-400 font-bold mt-2">악의 세력 최후의 기회</p>
                         <p className="text-xs text-slate-400 mt-1">멀린을 찾아내면 역전승합니다.</p>
                       </div>
                     </div>
                  )}
                  {roomData.status === 'evil_win' && (
                    <div className="text-center py-10 animate-in bounce-in">
                      <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-rose-500 to-red-700 drop-shadow-2xl mb-4">EVIL WINS</h2>
                      <div className="inline-block px-4 py-1 bg-rose-950 rounded border border-rose-800">
                        <p className="text-rose-500 text-xs font-bold uppercase tracking-[0.3em]">Game Over</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// --- 하위 컴포넌트 (UI 개선) ---

function TeamBuilding({ roomCode, players, roomData, user, isLeader }) {
  const [selected, setSelected] = useState([]);
  const need = roomData.questRules[roomData.currentQuestIndex];
  
  const toggle = (id) => {
    if(!isLeader) return;
    if(selected.includes(id)) setSelected(selected.filter(i=>i!==id));
    else if(selected.length < need) setSelected([...selected, id]);
  };
  
  const submit = async () => {
    if(selected.length!==need) return;
    await updateDoc(doc(db,'rooms',roomCode), { phase:'voting', currentTeam:selected, votes:{} });
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-black text-white tracking-tight">원정대 구성</h3>
        <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-900/30 inline-block px-3 py-1 rounded-full border border-indigo-500/30">
          Select {need} Knights
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {players.map(p => {
          const isSelected = selected.includes(p.id);
          return (
            <div 
              key={p.id} 
              onClick={()=>toggle(p.id)} 
              className={`relative p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between overflow-hidden group
                ${isSelected 
                  ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.4)] scale-[1.02] z-10' 
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:border-slate-600'}
                ${isLeader ? 'cursor-pointer active:scale-95' : 'opacity-60 pointer-events-none grayscale'}
              `}
            >
              <div className="flex items-center gap-2 relative z-10">
                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white shadow-[0_0_5px_white]' : 'bg-slate-600'}`}></div>
                <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>{p.name}</span>
              </div>
              {isSelected && <CheckCircle2 size={18} className="text-white z-10 drop-shadow-md"/>}
              {isSelected && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500 opacity-20 bg-[length:200%_100%] animate-[shimmer_2s_infinite]"></div>}
            </div>
          )
        })}
      </div>

      {isLeader && (
        <button 
          onClick={submit} 
          disabled={selected.length!==need} 
          className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-blue-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-indigo-900/30 transition-all active:scale-[0.98] border border-white/10"
        >
          원정대 제안 승인
        </button>
      )}
      {!isLeader && (
        <p className="text-center text-xs text-slate-500 font-bold animate-pulse mt-4">대장이 원정대를 선발하고 있습니다...</p>
      )}
    </div>
  );
}

function Voting({ roomCode, roomData, user }) {
  const voted = roomData.votes?.[user.uid] !== undefined;
  
  const vote = async (appr) => {
    const newVotes = { ...roomData.votes, [user.uid]: appr };
    if(Object.keys(newVotes).length === roomData.playerCount) {
      const y = Object.values(newVotes).filter(v=>v).length;
      if(y > Object.values(newVotes).length/2) {
        await updateDoc(doc(db,'rooms',roomCode), { votes:newVotes, phase:'quest', questVotes:{} });
      } else {
        await updateDoc(doc(db,'rooms',roomCode), { votes:newVotes, phase:'team_building', leaderIndex:(roomData.leaderIndex+1)%roomData.playerCount });
      }
    } else {
      await updateDoc(doc(db,'rooms',roomCode), { [`votes.${user.uid}`]: appr });
    }
  };

  if(voted) return (
    <div className="text-center py-12 animate-pulse space-y-4">
      <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto border border-slate-700 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <Scroll className="text-slate-500" size={32} />
      </div>
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Waiting for Council...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in zoom-in duration-300">
      <div className="text-center">
        <h3 className="text-xl font-black text-white">원정 승인 투표</h3>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Accept or Reject the Proposal</p>
      </div>
      
      {/* Proposal Summary */}
      <div className="flex justify-center gap-2 mb-4">
        {roomData.currentTeam.map(uid => (
             <div key={uid} className="w-8 h-8 rounded-full bg-slate-700 border border-slate-500 flex items-center justify-center text-[10px] text-white font-bold" title="Selected Knight">
               <Sword size={12}/>
             </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button onClick={()=>vote(true)} className="flex-1 bg-slate-800 hover:bg-emerald-900/30 hover:border-emerald-500/50 border border-slate-700 p-6 rounded-[2rem] flex flex-col items-center gap-3 transition-all group active:scale-95">
          <div className="p-5 bg-slate-900 rounded-full group-hover:bg-emerald-500 group-hover:text-white transition-all text-emerald-500 shadow-lg group-hover:shadow-emerald-500/50">
            <ThumbsUp size={36} />
          </div>
          <span className="font-black text-slate-300 group-hover:text-emerald-400 text-lg uppercase tracking-widest">승인</span>
        </button>
        <button onClick={()=>vote(false)} className="flex-1 bg-slate-800 hover:bg-rose-900/30 hover:border-rose-500/50 border border-slate-700 p-6 rounded-[2rem] flex flex-col items-center gap-3 transition-all group active:scale-95">
          <div className="p-5 bg-slate-900 rounded-full group-hover:bg-rose-500 group-hover:text-white transition-all text-rose-500 shadow-lg group-hover:shadow-rose-500/50">
            <ThumbsDown size={36} />
          </div>
          <span className="font-black text-slate-300 group-hover:text-rose-400 text-lg uppercase tracking-widest">거부</span>
        </button>
      </div>
    </div>
  );
}

function Quest({ roomCode, roomData, user, myRole }) {
  const isMember = roomData.currentTeam.includes(user.uid);
  const acted = roomData.questVotes?.[user.uid] !== undefined;
  
  const action = async (success) => {
    const newVotes = { ...roomData.questVotes, [user.uid]: success };
    if(Object.keys(newVotes).length === roomData.currentTeam.length) {
      const fails = Object.values(newVotes).filter(v=>!v).length;
      const isFail = fails >= 1; 
      const newScores = [...roomData.questScores];
      newScores[roomData.currentQuestIndex] = !isFail;
      
      const sTotal = newScores.filter(s=>s===true).length;
      const fTotal = newScores.filter(s=>s===false).length;
      let ph = 'team_building'; let st = 'playing';
      if(sTotal>=3) { ph='assassin'; st='assassin_phase'; }
      if(fTotal>=3) { ph='game_over'; st='evil_win'; }
      
      await updateDoc(doc(db,'rooms',roomCode), {
        questVotes: newVotes, questScores: newScores, currentQuestIndex: roomData.currentQuestIndex+1,
        phase: ph, status: st, leaderIndex: (roomData.leaderIndex+1)%roomData.playerCount
      });
    } else {
      await updateDoc(doc(db,'rooms',roomCode), { [`questVotes.${user.uid}`]: success });
    }
  };

  if(!isMember) return (
    <div className="text-center py-12 space-y-4 opacity-70">
      <div className="inline-block p-4 border-2 border-slate-700 rounded-full animate-spin-slow">
        <Sword size={32} className="text-slate-500"/>
      </div>
      <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">Mission in Progress...</p>
    </div>
  );
  
  if(acted) return (
    <div className="text-center py-12 space-y-4">
      <CheckCircle2 size={48} className="text-emerald-500 mx-auto animate-bounce" />
      <p className="text-emerald-400 font-bold text-sm tracking-widest uppercase">Decision Recorded</p>
    </div>
  );

  const isEvil = ['암살자','모르가나','미니언','오베론','모드레드'].includes(myRole);
  
  return (
    <div className="space-y-8 animate-in zoom-in duration-300">
      <div className="text-center">
        <h3 className="text-xl font-black text-white">임무 수행</h3>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Determine the Fate of the Kingdom</p>
      </div>
      <div className="flex gap-4">
        <button onClick={()=>action(true)} className="flex-1 bg-slate-800 hover:bg-blue-900/30 hover:border-blue-500/50 border border-slate-700 p-6 rounded-[2rem] flex flex-col items-center gap-3 transition-all group active:scale-95">
          <div className="p-5 bg-slate-900 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all text-blue-500 shadow-lg group-hover:shadow-blue-600/50">
            <Shield size={36} />
          </div>
          <span className="font-black text-slate-300 group-hover:text-blue-400 text-lg uppercase tracking-widest">성공</span>
        </button>
        {isEvil && (
          <button onClick={()=>action(false)} className="flex-1 bg-slate-800 hover:bg-rose-900/30 hover:border-rose-500/50 border border-slate-700 p-6 rounded-[2rem] flex flex-col items-center gap-3 transition-all group active:scale-95">
            <div className="p-5 bg-slate-900 rounded-full group-hover:bg-rose-600 group-hover:text-white transition-all text-rose-500 shadow-lg group-hover:shadow-rose-600/50">
              <Sword size={36} />
            </div>
            <span className="font-black text-slate-300 group-hover:text-rose-400 text-lg uppercase tracking-widest">실패</span>
          </button>
        )}
      </div>
      {!isEvil && <p className="text-center text-[10px] text-slate-500 font-bold bg-slate-900/50 py-2 rounded-lg border border-slate-800">* 선의 세력은 오직 '성공'만 선택할 수 있습니다.</p>}
    </div>
  );
}

