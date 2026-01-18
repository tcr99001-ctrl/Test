'use client';

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, onSnapshot, collection, updateDoc, deleteDoc, getDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Play, RefreshCw, Eye, EyeOff, Users, Copy, CheckCircle2, Crown, 
  Sword, Shield, ThumbsUp, ThumbsDown, AlertCircle, Share2, 
  Link as LinkIcon, Sparkles, XCircle, Scroll, Skull
} from 'lucide-react';

// ==================================================================
// [필수] 사용자님의 Firebase 설정값
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

// --- [2] 게임 룰 & 유틸리티 ---
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

  // Init
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

  // Presence
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

  if(!user) return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-slate-400 font-sans gap-4">
      <div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
      <p className="animate-pulse tracking-widest text-xs uppercase">Connecting to Avalon...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      
      {/* 배경 장식 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      <div className="relative mx-auto max-w-lg min-h-screen flex flex-col p-6">
        
        {/* 헤더 */}
        <header className="flex items-center justify-between py-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg shadow-blue-500/20">
              <Sword size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">AVALON</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">The Resistance</p>
            </div>
          </div>
          {isJoined && roomCode && (
            <div className="px-4 py-2 bg-slate-900/50 border border-slate-800 rounded-full backdrop-blur-md">
              <span className="text-xs font-mono font-bold text-amber-500 tracking-widest">{roomCode}</span>
            </div>
          )}
        </header>

        {/* 메인 컨텐츠 영역 */}
        <main className="flex-1 flex flex-col relative z-10">
          
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-4">
              <AlertCircle className="text-red-400 shrink-0" size={20} />
              <p className="text-sm font-medium text-red-200">{error}</p>
              <button onClick={()=>setError(null)} className="ml-auto text-red-400 hover:text-white">✕</button>
            </div>
          )}

          {/* 1. 입장 화면 */}
          {!isJoined && (
            <div className="my-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="text-center space-y-2 mb-10">
                <h2 className="text-4xl font-black text-white">원탁의 기사단</h2>
                <p className="text-slate-400 text-sm">성스러운 임무를 수행할 준비가 되셨습니까?</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nickname</label>
                  <input 
                    value={playerName} 
                    onChange={e=>setPlayerName(e.target.value)} 
                    placeholder="기사님의 이름" 
                    className="w-full bg-slate-900/80 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 rounded-2xl px-5 py-4 text-lg font-bold text-white placeholder-slate-600 outline-none transition-all"
                  />
                </div>

                {!roomCode ? (
                  <>
                    <button 
                      onClick={handleCreate} 
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                    >
                      <Sparkles size={20} className="group-hover:animate-spin-slow" /> 새로운 원정대 결성
                    </button>
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                      <div className="relative flex justify-center"><span className="bg-slate-950 px-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Or Join</span></div>
                    </div>
                  </>
                ) : null}

                <div className="flex gap-3">
                  <input 
                    value={roomCode} 
                    onChange={e=>setRoomCode(e.target.value.toUpperCase())} 
                    placeholder="CODE" 
                    maxLength={4}
                    className="flex-1 bg-slate-900/80 border border-slate-800 focus:border-indigo-500 rounded-2xl text-center font-mono font-black text-xl uppercase outline-none transition-all"
                  />
                  <button 
                    onClick={handleJoin} 
                    className="flex-[1.5] bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-bold text-lg border border-slate-700 transition-all active:scale-[0.98]"
                  >
                    입장하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. 대기실 */}
          {isJoined && roomData?.status === 'lobby' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="p-6 bg-slate-900/50 border border-slate-800/50 rounded-[2rem] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex justify-between items-end relative z-10">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Knights</p>
                    <h2 className="text-4xl font-black text-white">{players.length} <span className="text-xl text-slate-600">/ 10</span></h2>
                  </div>
                  <div className="flex -space-x-2">
                    {players.slice(0,5).map(p=>(
                      <div key={p.id} className={`w-8 h-8 rounded-full border-2 border-slate-900 ${p.id===roomData.hostId?'bg-amber-400':'bg-gradient-to-br from-blue-400 to-indigo-500'}`}></div>
                    ))}
                    {players.length>5 && <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">+{players.length-5}</div>}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Player List</h3>
                  <button onClick={copyInviteLink} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                    {copyStatus==='link' ? <><CheckCircle2 size={12}/> Copied</> : <><LinkIcon size={12}/> Copy Link</>}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto pr-1">
                  {players.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${p.id===roomData.hostId?'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]':'bg-emerald-500'}`}></div>
                        <span className="font-bold text-slate-200">{p.name}</span>
                        {p.id===user.uid && <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-bold">YOU</span>}
                      </div>
                      {p.id===roomData.hostId && <Crown size={16} className="text-amber-500" />}
                    </div>
                  ))}
                </div>
              </div>

              {isHost ? (
                <div className="pt-4 mt-auto sticky bottom-0">
                  <button 
                    onClick={handleStart} 
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-5 rounded-[1.5rem] font-black text-xl shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  >
                    <Play fill="currentColor" size={24}/> 게임 시작
                  </button>
                  <p className="text-center text-[10px] text-slate-600 font-bold mt-3 uppercase tracking-widest">Min 5 Players Required</p>
                </div>
              ) : (
                <div className="mt-auto p-4 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 text-center">
                  <p className="text-xs font-bold text-slate-500 animate-pulse">방장의 시작을 기다리는 중...</p>
                </div>
              )}
            </div>
          )}

          {/* 3. 게임 플레이 */}
          {isJoined && roomData?.status === 'playing' && myData && (
            <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
              
              {/* 점수판 트랙 */}
              <div className="relative pt-2 pb-6 px-1">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-800 rounded-full -z-10"></div>
                <div className="flex justify-between items-center">
                  {roomData.questScores.map((s,i) => (
                    <div key={i} className={`relative group transition-all duration-500 ${i===roomData.currentQuestIndex ? 'scale-110' : 'scale-100'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-4 transition-colors duration-300 z-10 relative
                        ${s===true ? 'bg-blue-600 border-blue-800 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 
                          s===false ? 'bg-rose-600 border-rose-800 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 
                          i===roomData.currentQuestIndex ? 'bg-slate-900 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse' : 
                          'bg-slate-900 border-slate-700 text-slate-600'}`}>
                        {s===true ? 'O' : s===false ? 'X' : i+1}
                      </div>
                      {/* 필요 인원수 뱃지 */}
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500 bg-slate-900 px-1.5 rounded border border-slate-800">
                        {roomData.questRules[i]}인
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 역할 카드 (토글) */}
              <div 
                onClick={()=>setIsRevealed(!isRevealed)} 
                className={`relative overflow-hidden cursor-pointer rounded-3xl border transition-all duration-500 group select-none
                  ${isRevealed 
                    ? (myData.isEvil 
                        ? 'bg-gradient-to-br from-rose-950 to-slate-950 border-rose-500/30' 
                        : 'bg-gradient-to-br from-blue-950 to-slate-950 border-blue-500/30') 
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
              >
                <div className="p-6 text-center min-h-[140px] flex flex-col items-center justify-center relative z-10">
                  {isRevealed ? (
                    <div className="animate-in zoom-in duration-300 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Your Identity</p>
                      <p className={`text-3xl font-black ${myData.isEvil ? 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.4)]'}`}>
                        {myData.role}
                      </p>
                      <p className="text-xs font-medium text-slate-300/80 leading-relaxed px-4 pt-2 border-t border-white/5 mt-2">
                        {myData.info}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 opacity-60 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-700">
                        <Eye size={20} className="text-slate-400"/>
                      </div>
                      <p className="text-sm font-bold text-slate-400 tracking-wide">터치하여 역할 확인 (비밀)</p>
                    </div>
                  )}
                </div>
                {/* 배경 효과 */}
                {isRevealed && <div className={`absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]`}></div>}
              </div>

              {/* 현재 리더 표시 */}
              <div className="flex items-center justify-center gap-2 py-2 bg-amber-500/5 border border-amber-500/10 rounded-full">
                <Crown size={14} className="text-amber-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Leader: </span>
                <span className="text-sm font-black text-amber-500">{players[roomData.leaderIndex]?.name}</span>
              </div>

              {/* === Phase UI Wrappers === */}
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem]">
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
                   <div className="text-center space-y-4 py-4 animate-in zoom-in">
                     <div className="inline-block p-4 bg-rose-500/10 rounded-full border border-rose-500/30 mb-2">
                       <Skull size={40} className="text-rose-500" />
                     </div>
                     <div>
                       <h2 className="text-2xl font-black text-rose-500 uppercase tracking-tight">Assassin Phase</h2>
                       <p className="text-sm text-rose-200/70 mt-2">악의 세력이 최후의 반격을 준비합니다.<br/>멀린을 찾아내면 역전승합니다.</p>
                     </div>
                   </div>
                )}
                {roomData.status === 'evil_win' && (
                  <div className="text-center py-6 animate-in bounce-in">
                    <h2 className="text-4xl font-black text-rose-600 drop-shadow-2xl mb-2">EVIL WINS</h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">Game Over</p>
                  </div>
                )}
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// --- 하위 컴포넌트 ---

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
    <div className="space-y-5 animate-in slide-in-from-right-4 duration-500">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-black text-white">원정대 구성</h3>
        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wide">
          {need}명의 기사를 선택하세요
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {players.map(p => {
          const isSelected = selected.includes(p.id);
          return (
            <div 
              key={p.id} 
              onClick={()=>toggle(p.id)} 
              className={`relative p-3 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between overflow-hidden
                ${isSelected 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30 scale-[1.02]' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}
                ${isLeader ? 'cursor-pointer active:scale-95' : 'opacity-80 pointer-events-none'}
              `}
            >
              <span className="text-sm font-bold z-10">{p.name}</span>
              {isSelected && <CheckCircle2 size={18} className="text-white z-10"/>}
              {isSelected && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-20"></div>}
            </div>
          )
        })}
      </div>

      {isLeader && (
        <button 
          onClick={submit} 
          disabled={selected.length!==need} 
          className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-blue-600 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-900/20 transition-all active:scale-[0.98]"
        >
          원정대 제안하기
        </button>
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
    <div className="text-center py-10 animate-pulse space-y-3">
      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-700">
        <Scroll className="text-slate-500" />
      </div>
      <p className="text-sm font-bold text-slate-500">다른 기사들의 결정을 기다리는 중...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in zoom-in duration-300">
      <div className="text-center">
        <h3 className="text-lg font-black text-white">원정 승인 투표</h3>
        <p className="text-xs text-slate-500 font-bold uppercase">제안된 원정대를 승인하시겠습니까?</p>
      </div>
      <div className="flex gap-4">
        <button onClick={()=>vote(true)} className="flex-1 bg-slate-800 hover:bg-emerald-600/20 hover:border-emerald-500/50 border border-slate-700 p-6 rounded-[2rem] flex flex-col items-center gap-3 transition-all group">
          <div className="p-4 bg-emerald-500/10 rounded-full group-hover:bg-emerald-500 group-hover:text-white transition-colors text-emerald-500">
            <ThumbsUp size={32} />
          </div>
          <span className="font-black text-slate-300 group-hover:text-emerald-400">승인</span>
        </button>
        <button onClick={()=>vote(false)} className="flex-1 bg-slate-800 hover:bg-rose-600/20 hover:border-rose-500/50 border border-slate-700 p-6 rounded-[2rem] flex flex-col items-center gap-3 transition-all group">
          <div className="p-4 bg-rose-500/10 rounded-full group-hover:bg-rose-500 group-hover:text-white transition-colors text-rose-500">
            <ThumbsDown size={32} />
          </div>
          <span className="font-black text-slate-300 group-hover:text-rose-400">거부</span>
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

  if(!isMember) return <div className="text-center py-10 text-slate-500 font-bold text-sm">⚔️ 원정대가 목숨을 건 임무를 수행 중입니다...</div>;
  if(acted) return <div className="text-center py-10 text-slate-500 font-bold text-sm">⏳ 결과를 숨죽여 기다리고 있습니다...</div>;

  const isEvil = ['암살자','모르가나','미니언','오베론','모드레드'].includes(myRole);
  
  return (
    <div className="space-y-6 animate-in zoom-in duration-300">
      <div className="text-center">
        <h3 className="text-lg font-black text-white">임무 수행</h3>
        <p className="text-xs text-slate-500 font-bold uppercase">당신의 선택이 왕국의 운명을 결정합니다</p>
      </div>
      <div className="flex gap-4">
        <button onClick={()=>action(true)} className="flex-1 bg-slate-800 hover:bg-blue-600/20 hover:border-blue-500/50 border border-slate-700 p-6 rounded-[2rem] flex flex-col items-center gap-3 transition-all group">
          <div className="p-4 bg-blue-500/10 rounded-full group-hover:bg-blue-500 group-hover:text-white transition-colors text-blue-500">
            <Shield size={32} />
          </div>
          <span className="font-black text-slate-300 group-hover:text-blue-400">성공</span>
        </button>
        {isEvil && (
          <button onClick={()=>action(false)} className="flex-1 bg-slate-800 hover:bg-rose-600/20 hover:border-rose-500/50 border border-slate-700 p-6 rounded-[2rem] flex flex-col items-center gap-3 transition-all group">
            <div className="p-4 bg-rose-500/10 rounded-full group-hover:bg-rose-500 group-hover:text-white transition-colors text-rose-500">
              <Sword size={32} />
            </div>
            <span className="font-black text-slate-300 group-hover:text-rose-400">실패</span>
          </button>
        )}
      </div>
      {!isEvil && <p className="text-center text-[10px] text-slate-600 font-bold">* 선의 세력은 '성공'만 선택할 수 있습니다.</p>}
    </div>
  );
    }
