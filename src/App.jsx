import { useEffect, useMemo, useRef, useState } from 'react'
import './Common.css'
import { heicTo } from "heic-to";
import Home from './Home.jsx'
import MyPage, { SocialListModal } from './MyPage.jsx'

/* ── 初期データ ─────────────────────────────────────────── */
const seedPosts = [
  { id: 'p1', userId: 'MG-2048', name: 'はるこ', avatar: 'は', rating: 4.5, image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=900&h=900&fit=crop', location: 'とんかつ みずき', comment: 'だしが効いた塩ラーメンがとてもおいしい！スープまで飲み干したくなる優しい味でした。お店の方も穏やかで、ひと休みにぴったりです。', likes: 18, comments: [{ name: 'みお', text: '行ってみたいです！' }], saved: false, pin: { x: 62, y: 44 } },
  { id: 'p2', userId: 'MG-3157', name: 'たけし', avatar: 'た', rating: 5, image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=900&h=900&fit=crop', location: '麺屋 そら', comment: '香ばしいチャーシューと、濃いめのスープが最高。', likes: 31, comments: [], saved: false, pin: { x: 48, y: 57 } },
  { id: 'p3', userId: 'MG-4821', name: 'みお', avatar: 'み', rating: 3.5, image: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=900&h=900&fit=crop', location: 'パン屋 あお', comment: 'クロワッサンが外はサクサク、中はふんわり。コーヒーとの相性もよかったです。', likes: 12, comments: [{ name: 'はるこ', text: '今度行きます☕' }, { name: 'たけし', text: 'おいしそう!' }], saved: true, pin: { x: 38, y: 35 } },
  { id: 'p4', userId: 'MG-5532', name: 'ゆう', avatar: 'ゆ', rating: 4, image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=900&h=900&fit=crop', location: 'フルーツカフェ', comment: '季節の果物をたっぷり使ったケーキ。甘さ控えめで食べやすかったです。', likes: 27, comments: [], saved: false, pin: { x: 71, y: 68 } },
]

/* コンポーネント: 星評価を表示する。0.5刻みは半分の星で表現する */
function Stars({ value, size = 'normal' }) {
  const full = Math.floor(value)
  const half = value % 1 !== 0
  return <span className={`stars ${size}`} aria-label={`評価 ${value}`}>
    {'★'.repeat(full)}{half ? '⭐︎' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
  </span>
}

/* コンポーネント: 画面上部の共通ヘッダー */
function Header({ title, right, onBack }) {
  return <header className="topbar">
    {onBack ? <button className="icon-button back" onClick={onBack}>‹</button> : <div className="header-spacer" />}
    <h1>{title}</h1>
    <div className="header-right">{right}</div>
  </header>
}

/* ログインと新規登録を切り替える画面 */
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    setError('')
    const accounts = JSON.parse(localStorage.getItem('moglog_accounts') || '[]')

    if (mode === 'register') {
      if (!name.trim() || !password.trim()) return setError('表示名とパスワードを入力してください')
      let id
      do { id = `MG-${Math.floor(1000 + Math.random() * 9000)}` } while (accounts.some((item) => item.userId === id))
      const account = { userId: id, name: name.trim(), password, profile: null }
      accounts.push(account)
      localStorage.setItem('moglog_accounts', JSON.stringify(accounts))
      onLogin(account)
      return
    }

    const account = accounts.find((item) => item.userId === userId.trim() && item.password === password)
    if (account) onLogin(account)
    else setError('ユーザーIDまたはパスワードが違います')
  }

  return <main className="auth-screen"><div className="brand-mark"><span>もぐ</span><span>ろぐ</span></div><h1 className="brand-name">もぐろぐ</h1><p className="tagline">おいしいを、やさしく記録しよう</p>
    <form className="auth-card" onSubmit={submit}>{mode === 'register' ? <><label>表示名<input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：はるこ" /></label><label>パスワード<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="好きなパスワード" /></label></> : <><label>ユーザーID<input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="MG-1234" /></label><label>パスワード<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード" /></label></>}{error && <p className="form-error">{error}</p>}<button className="primary-button" type="submit">{mode === 'register' ? 'はじめる' : 'ログイン'}</button><button className="text-button" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? '初めての方はこちら' : 'すでにアカウントがある方'}</button></form>
  </main>
}

/* 初回ログイン時の好み設定。濃さは薄味・普通・濃い味の3段階 */
function ProfileSetup({ account, onSave }) {
  const [foods, setFoods] = useState(account.profile?.favoriteFoods || '')
  const [preferences, setPreferences] = useState(account.profile ? { '辛さ': account.profile['辛さ'] ?? 2, '甘さ': account.profile['甘さ'] ?? 2, '濃さ': account.profile['濃さ'] ?? 1 } : { '辛さ': 2, '甘さ': 2, '濃さ': 1 })
  const save = () => onSave({ favoriteFoods: foods, ...preferences })

  return <main className="setup-screen"><div className="setup-illustration">🍽️</div><h1>好みを教えてね</h1><p className="setup-subtitle">あなたに合う投稿が見つかりやすくなります</p>
    <section className="profile-form"><label>好きな食べ物 <span>任意</span><input value={foods} onChange={(e) => setFoods(e.target.value)} placeholder="ラーメン" /></label>
      {['辛さ', '甘さ', '濃さ'].map((key) => <div className="scale-row" key={key}><b>{key}の好み</b><div className={key === '濃さ' ? 'scale-options strength-options' : 'scale-options'}>
        {(key === '濃さ' ? [0, 1, 2] : [0, 1, 2, 3, 4]).map((value) => <button key={value} type="button" className={preferences[key] === value ? 'selected' : ''} onClick={() => setPreferences((old) => ({ ...old, [key]: value }))}><span>{key === '濃さ' ? ['薄味', '普通', '濃い味'][value] : ['苦手', 'やや苦手', '普通', 'やや好き', '好き'][value]}</span></button>)}</div></div>)}
      <button className="primary-button" onClick={save}>保存して完了</button>
    </section>
  </main>
}

/* 投稿カード。コメントは投稿者のコメントと、他の人のコメントの両方を表示する */
function LegacyPostCard({ post, onSave, onComment, onProfile, onMap, accountName }) {
  const [expanded, setExpanded] = useState(false)
  const [activeAction, setActiveAction] = useState('photo')
  const [comment, setComment] = useState('')

  const addComment = (event) => {
    event.preventDefault()
    if (!comment.trim()) return
    onComment(post.id, comment.trim())
    setComment('')
  }

  const selectComment = () => setActiveAction((current) => current === 'comment' ? 'photo' : 'comment')
  const selectLocation = () => setActiveAction((current) => current === 'map' ? 'photo' : 'map')

  return <article className="post-card">
    <div className="post-author"><button className="author-button" onClick={() => onProfile(post)}><span className="avatar">{post.avatar}</span><b>{post.name}</b></button><Stars value={post.rating} /></div>
    <div className="post-photo"><img src={post.image} alt={post.location || '投稿写真'} /></div>
    <div className="post-actions">
      <button className={`post-action-button ${activeAction === 'comment' ? 'active-action' : ''}`} aria-label="コメント" onClick={selectComment}><span>💬</span><small>{post.comments.length}</small></button>
      <button className={`post-action-button ${activeAction === 'map' ? 'active-action' : ''}`} aria-label="場所を確認" onClick={selectLocation}><span>📍</span></button>
      <button className="post-action-button" aria-label="保存" onClick={() => onSave(post.id)}><span className={post.saved ? 'saved' : ''}>📁</span></button>
    </div>
    <div className="post-detail">
      {activeAction === 'photo' && <>
        <p className={expanded ? 'photo-comment expanded' : 'photo-comment'}>{post.comment}</p>
        {post.comment && post.comment.length > 45 && <button className="read-more" onClick={() => setExpanded(!expanded)}>{expanded ? '閉じる' : '全文を読む'}</button>}
      </>}
      {activeAction === 'comment' && <div className="comments-panel">
        {post.comments.map((item, index) => {
          const isMine = item.name === accountName
          return <div className={`chat-row ${isMine ? 'mine' : 'other'}`} key={`${item.name}-${index}`}><span className="chat-avatar">⚪</span><div className="chat-bubble"><b>{item.name}</b><span>{item.text}</span></div></div>
        })}
        {post.comments.length === 0 && <p className="no-comments">まだコメントはありません</p>}
        <form className="comment-form" onSubmit={addComment}><input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="コメントを書く" /><button>送信</button></form>
      </div>}
      {activeAction === 'map' && <div className="inline-place"><b>{post.location}</b><div className="inline-map"><span className="road r1"/><span className="road r2"/><span className="map-pin" style={{ left: `${post.pin?.x || 50}%`, top: `${post.pin?.y || 50}%` }}>📍</span></div></div>}
    </div>
  </article>
}

/* ホーム画面。星評価は0を含めて絞り込む */
function LegacyHome({ posts, onSave, onComment, onProfile, onMap, onCreate, accountName }) {
  const [ratingFilter, setRatingFilter] = useState('all')
  const [peopleFilter, setPeopleFilter] = useState('all')
  const people = useMemo(() => ['all', ...new Set(posts.map((post) => post.name))], [posts])
  const filtered = posts.filter((post) => (ratingFilter === 'all' || post.rating === Number(ratingFilter)) && (peopleFilter === 'all' || post.name === peopleFilter))
  return <main className="home-screen"><Header title="もぐろぐ" right={<button className="create-button" onClick={onCreate}>＋ 投稿</button>} /><div className="filters"><select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} aria-label="星評価で絞り込み"><option value="all">すべての星</option>{[5,4.5,4,3.5,3,2.5,2,1.5,1,0.5,0].map((n) => <option key={n} value={n}>{n === 0 ? '0 ★' : `${n} ★`}</option>)}</select><select value={peopleFilter} onChange={(e) => setPeopleFilter(e.target.value)} aria-label="人で絞り込み">{people.map((person) => <option key={person} value={person}>{person === 'all' ? 'すべての人' : person}</option>)}</select></div><div className="feed-grid">{filtered.map((post) => <PostCard key={post.id} post={post} onSave={onSave} onComment={onComment} onProfile={onProfile} onMap={onMap} accountName={accountName} />)}</div></main>
}

/* 投稿作成画面。スマホの写真選択に対応し、場所は店名で入力する */
function CreatePost({ account, onCancel, onCreate }) {
  const [image, setImage] = useState('')
  const [location, setLocation] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

 const chooseImage = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  let uploadFile = file;

  const isHeic =
    /\.hei(c|f)$/i.test(file.name) ||
    file.type === 'image/heic' ||
    file.type === 'image/heif';

  // HEICをJPEGに変換
  if (isHeic) {
    try {
      uploadFile = await heicTo({
        blob: file,
        type: 'image/jpeg',
        quality: 0.92,
      });
    } catch {
      alert('HEIC写真をJPEGに変換できませんでした。JPEG形式でアップロードしてください。');
      return;
    }
  }

  // 写真を読み込む
  const reader = new FileReader();

  reader.onload = () => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');

      // 最大サイズを1200pxにする
      const maxSize = 1200;
      const scale = Math.min(
        1,
        maxSize / Math.max(img.width, img.height)
      );

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // JPEG形式に圧縮
      const compressedImage = canvas.toDataURL('image/jpeg', 0.7);

      setImage(compressedImage);
    };

    img.src = reader.result;
  };

  reader.readAsDataURL(uploadFile);
};

  const submit = () => {
    if (!image) return
    onCreate({ id: `p-${Date.now()}`, userId: account.userId, name: account.name, avatar: account.name[0] || 'も', rating, image, location: location || '場所未設定', comment, comments: [], saved: false, pin: { x: 50, y: 50 } })
  }

  return <main className="create-screen"><Header title="新しい投稿" onBack={onCancel} right={<button className="header-save" onClick={submit}>投稿</button>} /><section className="create-form">
    <label className="photo-picker">{image ? <img src={image} alt="選択した写真" /> : <><span>📷</span><b>写真を選ぶ</b></>}<input type="file" accept="image/*,.heic,.heif" onChange={chooseImage} /></label>
    <label>お店・場所（任意）<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例：麺屋 そら" /></label>
    <div className="rating-picker"><b>評価</b><div className="rating-line" aria-label="評価を0から5まで0.5刻みで選択">{[0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5].map((n) => <button type="button" key={n} className={`rating-dot ${n % 1 === 0 ? 'integer' : 'half'} ${n <= rating ? 'selected' : ''}`} onClick={() => setRating(n)} aria-label={`${n}`}><span /></button>)}</div><div className="rating-scale"><span>0</span><strong>{rating} / 5</strong><span>5</span></div></div>
    <label>コメント（任意）<textarea value={comment} onChange={(e) => setComment(e.target.value)} rows="5" placeholder="お店の雰囲気や味を記録しましょう" /></label>
  </section></main>
}

/* プロフィール詳細。友達のユーザーIDは表示しない */
function ProfileModal({ post, onClose }) {
  const profile = post.profile || { favoriteFoods: 'ラーメン・スイーツ', '辛さ': 2, '甘さ': 3, '濃さ': 1 }
  const spicyLabels = ['苦手', 'やや苦手', '普通', 'やや好き', '好き']
  return <div className="overlay" onClick={onClose}><section className="profile-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><span className="large-avatar">{post.avatar}</span><h2>{post.name}</h2><h3>好きな食べ物</h3><p>{profile.favoriteFoods || '未設定'}</p>{['辛さ','甘さ','濃さ'].map((key) => <div className="profile-meter" key={key}><b>{key}</b><span>{key === '濃さ' ? ['薄味','普通','濃い味'][profile[key] ?? 1] : spicyLabels[profile[key] ?? 2]}</span><div><i style={{ width: `${key === '濃さ' ? ((profile[key] ?? 1) + 1) * 33.33 : ((profile[key] ?? 2) + 1) * 20}%` }} /></div></div>)}</section></div>
}

function MapModal({ post, onClose }) {
  return <div className="overlay" onClick={onClose}><section className="map-modal" onClick={(e) => e.stopPropagation()}>
    <button className="modal-close" onClick={onClose}>×</button><h2>{post.location}</h2>
    <div className="big-map"><span className="road r1"/><span className="road r2"/><span className="map-pin" style={{ left: `${post.pin?.x || 50}%`, top: `${post.pin?.y || 50}%` }}>📍</span></div>
  </section></div>
}

/* 保存投稿詳細。保存した投稿をタップすると内容全体を確認できる */
function SavedPostModal({ post, onClose, onComment, accountName }) {
  const [activeAction, setActiveAction] = useState('photo')
  const [comment, setComment] = useState('')
  const addComment = (event) => {
    event.preventDefault()
    if (!comment.trim()) return
    onComment(post.id, comment.trim())
    setComment('')
  }

  return <div className="overlay" onClick={onClose}><section className={`saved-detail-modal ${activeAction !== 'photo' ? 'active-surface' : ''}`} onClick={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose}>×</button>
    <img src={post.image} alt={post.location} />
    <div className="saved-detail-copy"><b>{post.name}</b><Stars value={post.rating} /><h3>{post.location}</h3>
      {activeAction === 'photo' && <p className="saved-photo-comment">{post.comment || 'コメントはありません'}</p>}
      {activeAction === 'comment' && <div className="comments-panel">
        {post.comments.map((item, index) => {
          const isMine = item.name === accountName
          return <div className={`chat-row ${isMine ? 'mine' : 'other'}`} key={index}><span className="chat-avatar">⚪</span><div className="chat-bubble"><b>{item.name}</b><span>{item.text}</span></div></div>
        })}
        {post.comments.length === 0 && <p className="no-comments">まだコメントはありません</p>}
        <form className="comment-form" onSubmit={addComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="コメントを書く" /><button>送信</button></form>
      </div>}
      {activeAction === 'map' && <div className="inline-place"><b>{post.location}</b><div className="inline-map"><span className="road r1"/><span className="road r2"/><span className="map-pin" style={{ left: `${post.pin?.x || 50}%`, top: `${post.pin?.y || 50}%` }}>📍</span></div></div>}
    </div>
    <div className="saved-actions"><button className={activeAction === 'comment' ? 'active-action' : ''} onClick={() => setActiveAction((current) => current === 'comment' ? 'photo' : 'comment')}>💬</button><button className={activeAction === 'map' ? 'active-action' : ''} onClick={() => setActiveAction((current) => current === 'map' ? 'photo' : 'map')}>📍</button></div>
  </section></div>
}

function LegacySocialListModal({ type, onClose, onAddFriend }) {
  const [friendId, setFriendId] = useState('')
  const [message, setMessage] = useState('')
  const follows = ['はるこ','たけし','みお','ゆう','さくら','けん','あや','りく','なお','めぐ','つばさ','ひなた']
  const followers = ['みお','ゆう','さくら','けん','あおい','そら','りん','かなた','ゆな','れん','まこ','はる','のん','こう','みさ','たいき','えみ','じゅん']
  const people = type === 'follow' ? follows : followers

  const addFriend = (event) => {
    event.preventDefault()
    const accounts = JSON.parse(localStorage.getItem('moglog_accounts') || '[]')
    const found = accounts.find((item) => item.userId === friendId.trim())
    if (!friendId.trim()) setMessage('友達のユーザーIDを入力してください')
    else if (!found) setMessage('そのユーザーIDが見つかりません')
    else { onAddFriend(found); setMessage(`${found.name}さんを友達に追加しました`) }
  }

  return <div className="overlay" onClick={onClose}><section className="social-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h2>{type === 'follow' ? 'フォロー' : 'フォロワー'}</h2>
    {type === 'follow' && <form className="friend-search" onSubmit={addFriend}><input value={friendId} onChange={(event) => setFriendId(event.target.value)} placeholder="友達のユーザーIDを検索" /><button>友達追加</button></form>}
    {message && <p className="friend-message">{message}</p>}
    <div className="social-list">{people.map((name) => <button key={name}><span className="small-avatar">{name[0]}</span><b>{name}</b>{type === 'follow' && <small>フォロー中</small>}</button>)}</div>
  </section></div>
}

function LegacyMyPage({ account, posts, onEditProfile, onOpenSavedPost, onOpenOwnPost, onCopyId, onSocial }) {
  const saved = posts.filter((post) => post.saved)
  const ownPosts = posts.filter((post) => post.userId === account.userId)
  const profile = account.profile
  const copyId = async () => { try { await navigator.clipboard?.writeText(account.userId) } catch { /* コピーAPI未対応時も完了表示を出す */ } onCopyId() }
  return <main className="mypage-screen">
    <Header title="マイページ" />
    <section className="my-profile"><span className="large-avatar">{account.name[0]}</span><div><h2>{account.name}</h2><button className="copy-id" onClick={copyId}>{account.userId} <span>コピー</span></button></div><button className="edit-profile" onClick={onEditProfile}>プロフィール編集</button></section>
    {profile && <section className="preference-summary"><h3>私の好み</h3><p><b>好きな食べ物</b><span>{profile.favoriteFoods || '未設定'}</span></p>{['辛さ','甘さ','濃さ'].map((key) => <p key={key}><b>{key}</b><span>{key === '濃さ' ? ['薄味','普通','濃い味'][profile[key] ?? 1] : ['苦手','やや苦手','普通','やや好き','好き'][profile[key]]}</span></p>)}</section>}
    <section className="social-counts"><button onClick={() => onSocial('follow')}><strong>15</strong><span>フォロー</span></button><button onClick={() => onSocial('follower')}><strong>15</strong><span>フォロワー</span></button><button onClick={() => document.querySelector('.saved-posts')?.scrollIntoView({ behavior: 'smooth' })}><strong>{saved.length}</strong><span>保存</span></button></section>
    <section className="own-posts"><h3>自分の投稿 <span>{ownPosts.length}</span></h3><div>{ownPosts.length ? ownPosts.map((post) => <button key={post.id} onClick={() => onOpenOwnPost(post)}><img src={post.image} alt={`${post.location}の投稿`} /></button>) : <p className="empty">投稿はまだありません</p>}</div></section>
    <section className="saved-posts"><h3>保存した投稿 <span>{saved.length}</span></h3><div>{saved.length ? saved.map((post) => <button key={post.id} onClick={() => onOpenSavedPost(post)}><img src={post.image} alt={`${post.location}の保存投稿`} /></button>) : <p className="empty">保存した投稿はまだありません</p>}</div></section>
  </main>
}

function App() {
  const [account, setAccount] = useState(() => JSON.parse(localStorage.getItem('moglog_current') || 'null'))
  const [screen, setScreen] = useState(account ? (account.profile ? 'home' : 'setup') : 'auth')
  const [tab, setTab] = useState('home')
  const [posts, setPosts] = useState(() => JSON.parse(localStorage.getItem('moglog_posts') || 'null') || seedPosts)
  const [modalPost, setModalPost] = useState(null)
  const [mapPost, setMapPost] = useState(null)
  const [savedPost, setSavedPost] = useState(null)
  const [socialType, setSocialType] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => localStorage.setItem('moglog_posts', JSON.stringify(posts)), [posts])

  const login = (nextAccount) => { setAccount(nextAccount); localStorage.setItem('moglog_current', JSON.stringify(nextAccount)); setScreen(nextAccount.profile ? 'home' : 'setup') }
  const saveProfile = (profile) => { const next = { ...account, profile }; setAccount(next); localStorage.setItem('moglog_current', JSON.stringify(next)); const accounts = JSON.parse(localStorage.getItem('moglog_accounts') || '[]').map((item) => item.userId === next.userId ? next : item); localStorage.setItem('moglog_accounts', JSON.stringify(accounts)); setScreen('home') }
  const toggleSave = (id) => setPosts((old) => old.map((post) => post.id === id ? { ...post, saved: !post.saved } : post))
  const addComment = (id, text) => setPosts((old) => old.map((post) => post.id === id ? { ...post, comments: [...post.comments, { name: account.name, text }] } : post))
  const openProfile = (post) => setModalPost(post.profile ? post : { ...post, profile: account.profile && post.userId === account.userId ? account.profile : post.profile })
  const createPost = (post) => { setPosts((old) => [{ ...post, profile: account.profile }, ...old]); setScreen('home'); setTab('home') }

  if (screen === 'auth') return <AuthScreen onLogin={login} />
  if (screen === 'setup') return <ProfileSetup account={account} onSave={saveProfile} />

  return <div className="app-shell">
    {screen === 'create' ? <CreatePost account={account} onCancel={() => setScreen('home')} onCreate={createPost} /> : tab === 'home' ? <Home posts={posts} onSave={toggleSave} onComment={addComment} onProfile={openProfile} onMap={setMapPost} onCreate={() => setScreen('create')} accountName={account.name} /> : <MyPage account={account} posts={posts} onEditProfile={() => setScreen('setup')} onOpenSavedPost={setSavedPost} onOpenOwnPost={setSavedPost} onCopyId={() => { setToast('ユーザーIDをコピーしました'); setTimeout(() => setToast(''), 1800) }} onSocial={setSocialType} />}
    {screen !== 'create' && <nav className="bottom-nav"><button className={tab === 'home' ? 'active' : ''} onClick={() => { setTab('home'); setScreen('home') }}><span>⌂</span><small>ホーム</small></button><button className={tab === 'mypage' ? 'active' : ''} onClick={() => { setTab('mypage'); setScreen('mypage') }}><span>♙</span><small>マイページ</small></button></nav>}
    {modalPost && <ProfileModal post={modalPost} onClose={() => setModalPost(null)} />}{mapPost && <MapModal post={mapPost} onClose={() => setMapPost(null)} />}{savedPost && <SavedPostModal post={savedPost} onClose={() => setSavedPost(null)} onComment={addComment} accountName={account.name} />}{socialType && <SocialListModal type={socialType} onClose={() => setSocialType(null)} onAddFriend={(friend) => setToast(`${friend.name}さんを友達に追加しました`)} />}{toast && <div className="toast">{toast}</div>}
  </div>
}

export default App
