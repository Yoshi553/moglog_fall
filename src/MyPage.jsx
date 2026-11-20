import './MyPage.css'

/* 共通ヘッダー: マイページタイトルを表示する */
function Header({ title }) {
  return <header className="topbar">
    <div className="header-spacer" />
    <h1>{title}</h1>
    <div className="header-right" />
  </header>
}

/* フォロー・フォロワー一覧モーダル: タップした人数を縦リストで表示する */
export function SocialListModal({ type, onClose, onAddFriend }) {
  const follows = ['はるこ','たけし','みお','ゆう','さくら','けん','あや','りく','なお','めぐ','つばさ','ひなた']
  const followers = ['みお','ゆう','さくら','けん','あおい','そら','りん','かなた','ゆな','れん','まこ','はる','のん','こう','みさ','たいき','えみ','じゅん']

  return <div className="overlay" onClick={onClose}><section className="social-modal" onClick={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose}>×</button>
    <h2>{type === 'follow' ? 'フォロー' : 'フォロワー'}</h2>
    <div className="social-list">
      {(type === 'follow' ? follows : followers).map((name) => <button key={name}><span className="small-avatar">{name[0]}</span><b>{name}</b>{type === 'follow' && <small>フォロー中</small>}</button>)}
    </div>
  </section></div>
}

/* マイページ: プロフィール・好み・件数・自分の投稿・保存投稿を表示する */
export default function MyPage({ account, posts, onEditProfile, onOpenSavedPost, onOpenOwnPost, onCopyId, onSocial }) {
  const saved = posts.filter((post) => post.saved)
  const ownPosts = posts.filter((post) => post.userId === account.userId)
  const profile = account.profile

  const copyId = async () => {
    try { await navigator.clipboard?.writeText(account.userId) } catch { /* コピーできない環境でも完了通知を表示 */ }
    onCopyId()
  }

  return <main className="mypage-screen">
    <Header title="マイページ" />

    <section className="my-profile">
      <span className="large-avatar">{account.name[0]}</span>
      <div><h2>{account.name}</h2><button className="copy-id" onClick={copyId}>{account.userId} <span>コピー</span></button></div>
      <button className="edit-profile" onClick={onEditProfile}>プロフィール編集</button>
    </section>

    {profile && <section className="preference-summary">
      <h3>私の好み</h3>
      <div className="favorite-foods">
            <b>好きな食べ物</b><span>{profile.favoriteFoods || '未設定'}</span>
      </div>

      <div className="preference-scales">
        {['辛さ','甘さ','濃さ'].map((key) => <p key={key}><b>{key}</b><span>{key === '濃さ' ? ['薄味','普通','濃い味'][profile[key] ?? 1] : ['苦手','やや苦手','普通','やや好き','好き'][profile[key]]}</span></p>)}
      </div>
    </section>}

    <section className="social-counts">
      <button onClick={() => onSocial('follow')}><strong>15</strong><span>フォロー</span></button>
      <button onClick={() => onSocial('follower')}><strong>15</strong><span>フォロワー</span></button>
      <button onClick={() => document.querySelector('.saved-posts')?.scrollIntoView({ behavior: 'smooth' })}><strong>{saved.length}</strong><span>保存</span></button>
    </section>

    <section className="own-posts">
      <h3>自分の投稿 <span>{ownPosts.length}</span></h3>
      <div>{ownPosts.length ? ownPosts.map((post) => <button key={post.id} onClick={() => onOpenOwnPost(post)}><img src={post.image} alt={`${post.location}の投稿`} /></button>) : <p className="empty">投稿はまだありません</p>}</div>
    </section>

    <section className="saved-posts">
      <h3>保存した投稿 <span>{saved.length}</span></h3>
      <div>{saved.length ? saved.map((post) => <button key={post.id} onClick={() => onOpenSavedPost(post)}><img src={post.image} alt={`${post.location}の保存投稿`} /></button>) : <p className="empty">保存した投稿はまだありません</p>}</div>
    </section>
  </main>
}
