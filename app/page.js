'use client';

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, onSnapshot, collection, updateDoc, deleteDoc, getDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Play, RefreshCw, Eye, EyeOff, Users, Copy, CheckCircle2, Crown, 
  Sword, Shield, ThumbsUp, ThumbsDown, AlertCircle, Share2, Link as LinkIcon 
} from 'lucide-react';

// ==================================================================
// [완료] 사용자님의 Firebase 설정값 적용됨
// ==================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBPd5xk9UseJf79GTZogckQmKKwwogneco",
  authDomain: "test-4305d.firebaseapp.com",
  projectId: "test-4305d",
  storageBucket: "test-4305d.firebasestorage.app",
  messagingSenderId: "402376205992",
  appId: "1:402376205992:web:be662592fa4d5f0efb849d"
};
// ==================================================================

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
  7: [2, 3, 3, 4, 4], // *4라운드 2장 실패 필요(구현 단순화됨)
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
    // 8인 이상
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

  // 접속 여부 확인
  const isJoined = user && players.some(p => p.id === user.uid);
  const isHost = roomData?.hostId === user?.uid;

  // URL 파라미터
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if(p.get('room')) setRoomCode(p.get('room').toUpperCase());
    }
  }, []);

  // 로그인
  useEffect(() => {
    if(!auth) return;
    const unsub = onAuthStateChanged(auth, u => {
      if(u) setUser(u);
      else signInAnonymously(auth).catch(console.error);
    });
    return () => unsub();
  }, []);

  // 데이터 동기화
  useEffect(() => {
    if(!user || !roomCode || roomCode.length!==4 || !db) return;
    const unsubRoom = onSnapshot(doc(db,'rooms',roomCode), s => setRoomData(s.exists()?s.data():null));
    const unsubPlayers = onSnapshot(collection(db,'rooms',roomCode,'players'), s => {
      const list=[]; s.forEach(d=>list.push({id:d.id, ...d.data()}));
      setPlayers(list);
    });
    return () => { unsubRoom(); unsubPlayers(); };
  }, [user, roomCode]);

  // ★ [핵심] Presence System (Heartbeat) - 5초마다 생존 신고
  useEffect(() => {
    if(!isJoined || !roomCode || !user) return;
    const heartbeat = async () => {
      try {
        await updateDoc(doc(db,'rooms',roomCode,'players',user.uid), { lastActive: Date.now() });
      } catch(e){}
    };
    heartbeat();
    const timer = setInterval(heartbeat, 5000);
    return () => clearInterval(timer);
  }, [isJoined, roomCode, user]);

  // ★ [핵심] 유령 유저 정리 (방장 전용) - 15초 잠수 시 삭제
  useEffect(() => {
    if(!isHost || !players.length) return;
    const cleaner = setInterval(() => {
      const now = Date.now();
      players.forEach(async p => {
        if(p.lastActive && now - p.lastActive > 15000) {
          try { await deleteDoc(doc(db,'rooms',roomCode,'players',p.id)); } catch(e){}
        }
      });
    }, 10000);
    return () => clearInterval(cleaner);
  }, [isHost, players, roomCode]);


  // --- 핸들러 함수들 ---
  const handleCreate = async () => {
    if(!playerName) return setError("이름 입력 필요");
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
    if(!playerName || roomCode.length!==4) return setError("정보 확인 필요");
    const snap = await getDoc(doc(db,'rooms',roomCode));
    if(!snap.exists()) return setError("방 없음");
    await setDoc(doc(db,'rooms',roomCode,'players',user.uid), { name: playerName, joinedAt: Date.now(), lastActive: Date.now() });
  };

  const handleStart = async () => {
    if(players.length < 5) return setError("최소 5명 필요");
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

  // 링크 복사
  const copyInviteLink = () => {
    if (typeof window === 'undefined') return;
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

  // 내 정보 계산
  const getMyData = () => {
    if(!user || !players.length) return null;
    const me = players.find(p=>p.id===user.uid);
    if(!me?.role) return null;
    let info = "";
    const evils = players.filter(p=>p.isEvil && p.role!=='오베론' && p.role!=='모드레드').map(p=>p.name).join(', ');
    const merlins = players.filter(p=>['멀린','모르가나'].includes(p.role)).map(p=>p.name).join(', ');
    
    if(me.role==='멀린') info=`악당: ${evils}`;
    else if(me.role==='퍼시벌') info=`멀린 후보: ${merlins}`;
    else if(me.isEvil && me.role!=='오베론') info=`동료: ${evils}`;
    else info="특수 능력이 없습니다.";
    return { ...me, info };
  };
  const myData = getMyData();

  // --- 렌더링 ---
  if(!user) return <div className="h-screen flex items-center justify-center bg-slate-900 text-amber-500 font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col items-center p-4">
      <div className="max-w-md w-full">
        {/* 헤더 */}
        <div className="bg-slate-800 p-6 rounded-t-2xl text-center border-b border-slate-700">
          <h1 className="text-2xl font-black text-amber-500 tracking-widest">AVALON</h1>
          {isJoined && <span className="inline-block bg-slate-900 px-2 py-1 rounded text-xs text-slate-400 mt-2">CODE: {roomCode}</span>}
        </div>

        <div className="bg-slate-800 p-6 rounded-b-2xl shadow-2xl min-h-[400px]">
          {error && <div className="mb-4 p-3 bg-red-900/50 text-red-200 text-xs rounded flex gap-2"><AlertCircle size={14}/>{error}</div>}

          {/* 1. 입장 화면 (아직 명단에 없을 때) */}
          {!isJoined && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="닉네임" className="w-full bg-slate-700 p-3 rounded text-white outline-none"/>
              {!roomCode && <button onClick={handleCreate} className="w-full bg-amber-600 p-3 rounded font-bold">방 만들기</button>}
              <div className="flex gap-2">
                <input value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase())} placeholder="CODE" className="flex-1 bg-slate-700 p-3 rounded text-center font-mono font-bold text-white"/>
                <button onClick={handleJoin} className="flex-1 bg-indigo-600 p-3 rounded font-bold">입장</button>
              </div>
            </div>
          )}

          {/* 2. 대기실 */}
          {isJoined && roomData?.status === 'lobby' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center"><h2 className="font-bold">대기실 ({players.length})</h2></div>
              
              {/* 초대 링크 버튼 */}
              <button 
                onClick={copyInviteLink}
                className="w-full bg-slate-700 border border-slate-600 p-3 rounded-xl flex items-center justify-between hover:bg-slate-600 transition-all"
              >
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Share2 size={16} /> 친구 초대 링크 복사
                </div>
                {copyStatus === 'link' ? <CheckCircle2 size={16} className="text-emerald-500"/> : <LinkIcon size={16} className="opacity-30"/>}
              </button>

              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {players.map(p => (
                  <div key={p.id} className="bg-slate-700 p-2 rounded flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${p.id===roomData.hostId?'bg-amber-400':'bg-emerald-400'}`}/>
                    {p.name}
                  </div>
                ))}
              </div>
              {isHost ? (
                <button onClick={handleStart} className="w-full bg-emerald-600 p-4 rounded-xl font-bold flex justify-center gap-2 mt-4"><Play size={20}/> 게임 시작</button>
              ) : <div className="text-center text-slate-500 text-sm py-4 animate-pulse">방장을 기다리는 중...</div>}
            </div>
          )}

          {/* 3. 게임 플레이 */}
          {isJoined && roomData?.status === 'playing' && myData && (
            <div className="space-y-6 animate-in fade-in">
              {/* 점수판 */}
              <div className="flex justify-between px-2 bg-slate-900 p-3 rounded-xl border border-slate-700">
                {roomData.questScores.map((s,i) => (
                  <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${s===true?'bg-blue-600':s===false?'bg-red-600':i===roomData.currentQuestIndex?'bg-amber-600 animate-pulse':'bg-slate-700'}`}>
                    {s===true?'O':s===false?'X':i+1}
                  </div>
                ))}
              </div>

              {/* 내 역할 */}
              <div onClick={()=>setIsRevealed(!isRevealed)} className={`cursor-pointer p-4 rounded-xl border-2 border-dashed text-center transition-all ${isRevealed?(myData.isEvil?'border-red-800 bg-red-900/20':'border-blue-800 bg-blue-900/20'):'border-slate-600 hover:bg-slate-700'}`}>
                {isRevealed ? (
                  <div><p className={`text-xl font-black ${myData.isEvil?'text-red-500':'text-blue-400'}`}>{myData.role}</p><p className="text-xs text-slate-400 mt-1">{myData.info}</p></div>
                ) : <span className="text-slate-500 text-sm font-bold flex items-center justify-center gap-2"><Eye size={16}/> 역할 확인 (비밀)</span>}
              </div>
              
              <div className="bg-slate-700/50 p-2 rounded text-center text-sm mb-2 border border-slate-700">
                👑 현재 리더: <span className="font-bold text-amber-400">{players[roomData.leaderIndex]?.name}</span>
              </div>

              {/* --- 단계별 UI --- */}
              
              {/* [1] 원정대 구성 */}
              {roomData.phase === 'team_building' && (
                <TeamBuilding roomCode={roomCode} players={players} roomData={roomData} user={user} isLeader={players[roomData.leaderIndex]?.id===user.uid} />
              )}
              
              {/* [2] 투표 */}
              {roomData.phase === 'voting' && (
                <Voting roomCode={roomCode} roomData={roomData} user={user} />
              )}

              {/* [3] 원정 */}
              {roomData.phase === 'quest' && (
                <Quest roomCode={roomCode} roomData={roomData} user={user} myRole={myData.role} />
              )}

              {/* [4] 종료/암살 */}
              {roomData.phase === 'assassin' && <div className="text-center p-4 bg-red-900/30 rounded border border-red-500"><h2 className="text-xl font-bold text-red-500">⚔️ 암살 단계</h2><p className="text-sm text-red-200">악의 세력은 멀린을 찾아야 합니다.</p></div>}
              {roomData.status === 'evil_win' && <div className="text-center p-4 bg-red-600 rounded shadow-lg"><h2 className="text-2xl font-black text-white">악의 세력 승리!</h2></div>}
            </div>
          )}
        </div>
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
    <div className="space-y-3 animate-in slide-in-from-right-4">
      <p className="text-center text-sm text-amber-500 font-bold">원정대 {need}명을 지명하세요</p>
      <div className="grid grid-cols-2 gap-2">
        {players.map(p => (
          <div key={p.id} onClick={()=>toggle(p.id)} className={`p-3 rounded border flex justify-between items-center transition-all ${selected.includes(p.id)?'bg-indigo-900 border-indigo-500 shadow-lg shadow-indigo-500/20':'bg-slate-800 border-slate-700'} ${isLeader?'cursor-pointer':''}`}>
            <span className="text-sm font-bold">{p.name}</span>
            {selected.includes(p.id) && <CheckCircle2 size={16} className="text-indigo-400"/>}
          </div>
        ))}
      </div>
      {isLeader && <button onClick={submit} disabled={selected.length!==need} className="w-full bg-indigo-600 disabled:bg-slate-700 p-3 rounded font-bold mt-2 transition-all">제안하기</button>}
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

  if(voted) return <div className="text-center text-slate-500 py-4 animate-pulse">다른 플레이어의 투표를 기다리는 중...</div>;
  return (
    <div className="flex gap-2 animate-in zoom-in">
      <button onClick={()=>vote(true)} className="flex-1 bg-emerald-700 hover:bg-emerald-600 p-4 rounded-xl flex flex-col items-center transition-all"><ThumbsUp className="mb-1"/>찬성</button>
      <button onClick={()=>vote(false)} className="flex-1 bg-rose-700 hover:bg-rose-600 p-4 rounded-xl flex flex-col items-center transition-all"><ThumbsDown className="mb-1"/>반대</button>
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
      let ph = 'team_building';
      let st = 'playing';
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

  if(!isMember) return <div className="text-center text-slate-500 py-4">원정대가 임무 수행 중...</div>;
  if(acted) return <div className="text-center text-slate-500 py-4">결과 대기 중...</div>;

  const isEvil = ['암살자','모르가나','미니언','오베론','모드레드'].includes(myRole);
  
  return (
    <div className="flex gap-2 animate-in zoom-in">
      <button onClick={()=>action(true)} className="flex-1 bg-blue-700 hover:bg-blue-600 p-6 rounded-xl flex flex-col items-center border border-blue-500 transition-all"><Shield size={32} className="mb-2"/>성공</button>
      {isEvil && <button onClick={()=>action(false)} className="flex-1 bg-red-800 hover:bg-red-700 p-6 rounded-xl flex flex-col items-center border border-red-500 transition-all"><Sword size={32} className="mb-2"/>실패</button>}
    </div>
  );
  }
