'use client';

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, onSnapshot, collection, updateDoc, getDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Play, RefreshCw, Eye, EyeOff, Users, Copy, CheckCircle2, 
  Crown, LogIn, AlertCircle, Share2, Link as LinkIcon 
} from 'lucide-react';

// ==================================================================
// [중요] 아래 firebaseConfig 내용을 본인의 설정값으로 바꿔주세요!
// Firebase 콘솔 -> 프로젝트 설정 -> 일반 -> 내 앱 -> SDK 설정 및 구성
// ==================================================================
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
// ==================================================================

// Firebase 초기화
let firebaseApp;
try {
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApps()[0];
  }
} catch (e) {
  console.error("Firebase 초기화 에러 (설정값을 확인하세요):", e);
}

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

export default function Home() {
  const [user, setUser] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [error, setError] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);

  // 1. URL 파라미터 감지 (초대 링크 기능)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const codeFromUrl = params.get('room');
      if (codeFromUrl && codeFromUrl.length === 4) {
        setRoomCode(codeFromUrl.toUpperCase());
      }
    }
  }, []);

  // 2. 익명 로그인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        signInAnonymously(auth).catch((err) => {
          console.error(err);
          setError("서버 접속 실패 (Firebase 설정을 확인하세요)");
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // 3. 방 데이터 실시간 동기화
  useEffect(() => {
    if (!user || !roomCode || roomCode.length !== 4) return;

    // 방 정보 구독
    const roomRef = doc(db, 'rooms', roomCode);
    const unsubscribeRoom = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setRoomData(docSnap.data());
        setError(null);
      } else {
        setRoomData(null);
      }
    }, (err) => {
      console.error(err);
      // 권한 에러 방지를 위해 간단한 메시지만 출력
    });

    // 플레이어 목록 구독
    const playersRef = collection(db, 'rooms', roomCode, 'players');
    const unsubscribePlayers = onSnapshot(playersRef, (querySnap) => {
      const pList = [];
      querySnap.forEach((d) => pList.push({ id: d.id, ...d.data() }));
      setPlayers(pList);
    });

    return () => { unsubscribeRoom(); unsubscribePlayers(); };
  }, [user, roomCode]);

  // 방 만들기
  const createRoom = async () => {
    if (!playerName.trim()) return setError("닉네임을 입력해주세요.");
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    try {
      // 방 기본 정보 생성
      await setDoc(doc(db, 'rooms', code), {
        hostId: user.uid,
        status: 'lobby',
        keyword: '',
        liarId: '',
        category: '',
        createdAt: Date.now()
      });
      // 플레이어 추가
      await setDoc(doc(db, 'rooms', code, 'players', user.uid), {
        name: playerName,
        joinedAt: Date.now()
      });
      setRoomCode(code);
    } catch (e) {
      console.error(e);
      setError("방 생성 실패 (Firestore 규칙을 확인하세요)");
    }
  };

  // 방 입장
  const joinRoom = async () => {
    const code = roomCode.toUpperCase();
    if (!playerName.trim() || code.length !== 4) return setError("이름과 코드를 확인해주세요.");
    try {
      const roomSnap = await getDoc(doc(db, 'rooms', code));
      if (!roomSnap.exists()) throw new Error("방을 찾을 수 없습니다.");
      
      await setDoc(doc(db, 'rooms', code, 'players', user.uid), {
        name: playerName, joinedAt: Date.now()
      });
      setRoomCode(code);
    } catch (e) {
      setError(e.message);
    }
  };

  // 게임 시작
  const startGame = async () => {
    if (players.length < 3) return setError("최소 3명이 필요합니다.");
    const categories = {
      '음식': ['치킨', '햄버거', '국밥', '비빔밥', '라면', '김치찌개', '삼겹살'],
      '동물': ['고양이', '독수리', '상어', '거북이', '토끼', '호랑이', '기린'],
      '장소': ['화장실', '도서관', '운동장', '목욕탕', '편의점', '학교', '군대'],
      '물건': ['지갑', '거울', '리모컨', '마우스', '충전기', '우산', '안경']
    };
    const cKeys = Object.keys(categories);
    const rCat = cKeys[Math.floor(Math.random() * cKeys.length)];
    const rWord = categories[rCat][Math.floor(Math.random() * categories[rCat].length)];
    const rLiar = players[Math.floor(Math.random() * players.length)].id;

    await updateDoc(doc(db, 'rooms', roomCode), {
      status: 'playing', category: rCat, keyword: rWord, liarId: rLiar
    });
  };

  // 초대 링크 복사
  const copyInviteLink = () => {
    if (typeof window === 'undefined') return;
    const inviteUrl = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopyStatus('link');
      setTimeout(() => setCopyStatus(null), 2000);
    });
  };

  if (!user) return <div className="h-screen flex items-center justify-center text-indigo-600 font-bold">서버 연결 중...</div>;

  return (
    <div className="min-h-screen flex flex-col items-center p-4 font-sans text-slate-900" style={{ fontFamily: 'sans-serif' }}>
      <div className="max-w-md w-full bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100" style={{ minHeight: '500px' }}>
        
        {/* 헤더 */}
        <div className="bg-indigo-600 p-8 text-white text-center">
          <h1 className="text-3xl font-black mb-2" style={{ fontWeight: 900 }}>LIAR GAME</h1>
          {roomCode && (
            <div className="inline-block bg-indigo-700/50 rounded-xl px-4 py-2 border border-indigo-500/30">
               <span className="font-mono text-xl font-bold">{roomCode}</span>
            </div>
          )}
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* 대문 */}
          {!roomData && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">닉네임</label>
                <input
                  type="text"
                  maxLength={10}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="사용할 이름"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 outline-none font-bold"
                  style={{ display: 'block', boxSizing: 'border-box' }}
                />
              </div>
              <div className="pt-2 space-y-3">
                <button 
                  onClick={createRoom}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all"
                >
                  방 만들기
                </button>
                <div className="flex items-center gap-3 text-slate-300 my-2">
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <span className="text-[10px] font-bold uppercase">OR</span>
                  <div className="h-px bg-slate-200 flex-1"></div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="초대 코드"
                    className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl text-center font-mono font-bold text-lg outline-none"
                    style={{ minWidth: 0 }}
                  />
                  <button onClick={joinRoom} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-black transition-all">
                    입장하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 대기실 */}
          {roomData && roomData.status === 'lobby' && (
            <div className="space-y-6">
              <h2 className="font-bold text-slate-700 text-lg">대기실 ({players.length}명)</h2>
              
              <button 
                onClick={copyInviteLink}
                className="w-full bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-xl flex items-center justify-between hover:bg-emerald-100 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg text-emerald-500 shadow-sm">
                    <Share2 size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">친구 초대하기</p>
                    <p className="text-[10px] opacity-70">클릭해서 링크 복사</p>
                  </div>
                </div>
                {copyStatus === 'link' ? <CheckCircle2 size={20} className="text-emerald-500"/> : <LinkIcon size={18} className="opacity-30"/>}
              </button>

              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {players.sort((a,b) => a.joinedAt - b.joinedAt).map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-700 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${p.id === roomData.hostId ? 'bg-amber-400' : 'bg-indigo-400'}`}></div>
                      {p.name} {p.id === user.uid && "(나)"}
                    </span>
                    {p.id === roomData.hostId && <Crown size={16} className="text-amber-500" />}
                  </div>
                ))}
              </div>

              {roomData.hostId === user.uid ? (
                <button onClick={startGame} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:bg-indigo-700">
                   게임 시작 <Play size={20} fill="currentColor" />
                </button>
              ) : (
                <div className="p-4 bg-slate-100 rounded-xl text-center text-xs font-bold text-slate-500">
                  방장이 시작하기를 기다리는 중...
                </div>
              )}
            </div>
          )}

          {/* 게임 진행 */}
          {roomData && roomData.status === 'playing' && (
            <div className="text-center space-y-6">
              <div>
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Theme</span>
                <h2 className="text-3xl font-black mt-2 text-slate-800">{roomData.category}</h2>
              </div>

              <div 
                className={`w-full min-h-[220px] rounded-[2rem] border-4 border-dashed flex flex-col items-center justify-center p-6 transition-all cursor-pointer select-none ${isRevealed ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-100 border-slate-200'}`}
                onClick={() => setIsRevealed(!isRevealed)}
              >
                {isRevealed ? (
                  <div className="animate-in zoom-in duration-200">
                    <EyeOff size={48} className="text-indigo-400 mb-4 mx-auto" />
                    <h3 className="text-3xl font-black text-indigo-900 mb-2">
                      {roomData.liarId === user.uid ? "당신은 라이어!" : roomData.keyword}
                    </h3>
                    <p className="text-indigo-400 text-xs font-medium">
                      {roomData.liarId === user.uid ? "들키지 않게 연기하세요." : "라이어에게 들키지 마세요."}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Eye size={48} className="text-slate-400 mb-4 mx-auto" />
                    <p className="text-xl font-black text-slate-500">터치해서 확인</p>
                  </div>
                )}
              </div>

              {roomData.hostId === user.uid && (
                <button 
                  onClick={() => updateDoc(doc(db, 'rooms', roomCode), { status: 'lobby' })}
                  className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} /> 대기실로 돌아가기
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
    }
