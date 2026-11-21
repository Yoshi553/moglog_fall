import { useState } from "react";
import "./MyPage.css";

/* 共通ヘッダー: マイページタイトルを表示する */
function Header({ title, onLogout }) {
  return (
    <header className="topbar">
      <div className="header-spacer" />
      <h1>{title}</h1>
      <div className="header-right"><button className="header-logout" onClick={onLogout}>ログアウト</button></div>
    </header>
  );
}

/*
 * SocialListModal（フォロー・フォロワー一覧モーダル）
 * searchOpenは友達追加や申請確認UIを開くか、confirmTargetは確認中のフォロー／フォロワーと種類を保持する。
 * follows/followersはローカルストレージへ保存し、再表示時にも一覧が残る。
 * フォロー中ボタンはその名前をconfirmTargetへ入れ、実行時に一覧から除外してフォロー解除とする。
 * フォロワーの削除も同じ確認ダイアログを経て、はいなら一覧から除外、いいえなら何も変更しない。
 */
export function SocialListModal({ type, onClose }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [friendId, setFriendId] = useState("");
  const [message, setMessage] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [follows, setFollows] = useState(() => JSON.parse(localStorage.getItem("moglog_follows") || "null") || ["はるこ","たけし","みお","ゆう","さくら","けん","あや","りく","なお","めぐ","つばさ","ひなた"]);
  const [followers, setFollowers] = useState(() => JSON.parse(localStorage.getItem("moglog_followers") || "null") || ["みお","ゆう","さくら","けん","あおい","そら","りん","かなた","ゆな","れん","まこ","はる","のん","こう","みさ","たいき","えみ","じゅん"]);

  const [requests, setRequests] = useState(() => JSON.parse(localStorage.getItem("moglog_friend_requests") || "null") || [
    { userId: "MG-4821", name: "みお" },
    { userId: "MG-5532", name: "ゆう" },
  ]);

  const sendRequest = (event) => {
    event.preventDefault();
    const accounts = JSON.parse(localStorage.getItem("moglog_accounts") || "[]");
    const found = accounts.find((item) => item.userId === friendId.trim());
    if (!friendId.trim()) setMessage("ユーザーIDを入力してください");
    else if (!found) setMessage("そのユーザーが見つかりません");
    else setMessage(`${found.name}さんに友達申請を送りました`);
  };

  const answerRequest = (userId, accepted) => {
    const next = requests.filter((item) => item.userId !== userId);
    setRequests(next);
    localStorage.setItem("moglog_friend_requests", JSON.stringify(next));
    setMessage(accepted ? "申請を許可しました" : "申請を拒否しました");
  };

  const toggleFollow = (name) => {
    const next = follows.includes(name) ? follows.filter((item) => item !== name) : [...follows, name];
    setFollows(next);
    localStorage.setItem("moglog_follows", JSON.stringify(next));
  };

  const confirmAction = (kind, name) => setConfirmTarget({ kind, name });
  const cancelAction = () => setConfirmTarget(null);
  const executeAction = () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "follow") {
      const next = follows.filter((item) => item !== confirmTarget.name);
      setFollows(next);
      localStorage.setItem("moglog_follows", JSON.stringify(next));
    } else {
      const next = followers.filter((item) => item !== confirmTarget.name);
      setFollowers(next);
      localStorage.setItem("moglog_followers", JSON.stringify(next));
    }
    setConfirmTarget(null);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <section className="social-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="social-modal-header">
          <h2>{type === "follow" ? "フォロー" : "フォロワー"}</h2>
          {type === "follow" ? (
            <button className="friend-add-button" onClick={() => setSearchOpen(!searchOpen)}>友達追加</button>
          ) : (
            <button className="friend-request-button" onClick={() => setSearchOpen(!searchOpen)}>申請確認 {requests.length}</button>
          )}
        </div>
        {searchOpen && type === "follow" && (
          <form className="friend-search" onSubmit={sendRequest}><input value={friendId} onChange={(event) => setFriendId(event.target.value)} placeholder="ユーザーIDを検索" /><button>申請</button></form>
        )}
        {message && <p className="friend-message">{message}</p>}
        {searchOpen && type === "follower" ? (
          <div className="friend-request-list">
            {requests.length ? requests.map((item) => (
              <div className="friend-request-row" key={item.userId}><span className="small-avatar">{item.name[0]}</span><b>{item.name}</b><button className="accept" onClick={() => answerRequest(item.userId, true)}>許可</button><button className="reject" onClick={() => answerRequest(item.userId, false)}>拒否</button></div>
            )) : <p className="empty">申請はありません</p>}
          </div>
        ) : (
          <div className="social-list">
            {(type === "follow" ? follows : followers).map((name) => (
              <div className="social-item" key={name}>
                <div className="social-item-main"><span className="small-avatar">{name[0]}</span><b>{name}</b>{type === "follow" ? <button className="following-button" onClick={() => confirmAction("follow", name)}>フォロー中</button> : <button className="follower-delete-button" onClick={() => confirmAction("follower", name)}>削除</button>}</div>
                {confirmTarget?.name === name && (
                  <div className="social-delete-modal" role="dialog" aria-modal="true">
                    <p>本当に削除しますか？</p>
                    <div><button className="confirm" onClick={executeAction}>はい</button><button className="cancel" onClick={cancelAction}>いいえ</button></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/*
 * MyPage（マイページ本体）
 * savedはpostsからsaved=trueだけを抽出し、ownPostsは投稿者IDが現在アカウントと一致する投稿だけを抽出する。
 * nameEditing/nameDraftは表示名変更モーダルと入力中の表示名を保持する。
 * deleteModeは投稿削除選択モード、selectedPostsは選択された投稿IDの配列。
 * 投稿数ボタンは自分の投稿セクションへスクロールし、保存一覧はサムネイル2列で表示する。
 */
export default function MyPage({
  account,
  posts,
  onEditProfile,
  onEditPreferences,
  onUpdateName,
  onOpenSavedPost,
  onOpenOwnPost,
  onCopyId,
  onSocial,
  onDeletePost,
  onLogout,
}) {
  const saved = posts.filter((post) => post.saved);
  const ownPosts = posts.filter((post) => post.userId === account.userId);
  const profile = account.profile;
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(account.name);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState([]);

  const copyId = async () => {
    try {
      await navigator.clipboard?.writeText(account.userId);
    } catch {
      /* コピーできない環境でも完了通知を表示 */
    }
    onCopyId();
  };

  const toggleDeleteMode = () => {
    setDeleteMode((prev) => !prev);
    if (deleteMode) setSelectedPosts([]);
  };

  const toggleSelectPost = (postId) => {
    setSelectedPosts((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  };

  const handleDeleteSelected = () => {
    selectedPosts.forEach((id) => onDeletePost(id));
    setSelectedPosts([]);
    setDeleteMode(false);
  };

  return (
    <main className="mypage-screen">
      <Header title="マイページ" onLogout={onLogout} />

      <section className="my-profile">
        <span className="large-avatar">{account.name[0]}</span>
        <div>
          <h2>{account.name}</h2>
          <button className="copy-id" onClick={copyId}>
            {account.userId} <span aria-label="コピー">📝</span>
          </button>
        </div>
        <button className="edit-profile" onClick={() => setNameEditing(true)}>
          プロフィール編集
        </button>
      </section>

      {profile && (
        <section className="preference-summary">
          <div className="preference-header">
            <h3>私の好み</h3>
            <button onClick={onEditPreferences}>編集</button>
          </div>
          <div className="favorite-foods">
            <b>好きな食べ物</b>
            <span>{profile.favoriteFoods || "未設定"}</span>
          </div>

          <div className="preference-scales">
            {["辛さ", "甘さ", "濃さ"].map((key) => (
              <p key={key}>
                <b>{key}</b>
                <span>
                  {key === "濃さ"
                    ? ["薄味", "普通", "濃い味"][profile[key] ?? 1]
                    : ["苦手", "やや苦手", "普通", "やや好き", "好き"][
                        profile[key]
                      ]}
                </span>
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="social-counts">
        <button onClick={() => onSocial("follow")}>
          <strong>15</strong>
          <span>フォロー</span>
        </button>
        <button onClick={() => onSocial("follower")}>
          <strong>15</strong>
          <span>フォロワー</span>
        </button>
        <button
          onClick={() =>
            document
              .querySelector(".own-posts")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <strong>{ownPosts.length}</strong>
          <span>投稿数</span>
        </button>
      </section>

      <section className="saved-posts">
        <h3>保存した投稿 <span>{saved.length}</span></h3>
        <div>{saved.length ? saved.map((post) => (
          <button key={post.id} onClick={() => onOpenSavedPost(post)}>
            <img src={post.image} alt={`${post.location}の保存投稿`} />
          </button>
        )) : <p className="empty">保存した投稿はまだありません</p>}</div>
      </section>

      <section className="own-posts">
        <div className="own-post-header"><h3>自分の投稿 <span>{ownPosts.length}</span></h3><button className="delete-mode-button" onClick={toggleDeleteMode}>{deleteMode ? "キャンセル" : "削除"}</button></div>
        <div>
          {deleteMode && <button className="delete-selected-button" onClick={handleDeleteSelected} disabled={selectedPosts.length === 0}>選択した投稿を削除</button>}
        </div>
        <div>{ownPosts.length ? ownPosts.map((post) => (
          <div className="own-post-item" key={post.id}>
            <button className="own-post-image" onClick={() => deleteMode ? toggleSelectPost(post.id) : onOpenOwnPost(post)}>
              <img src={post.image} alt={`${post.location}の投稿`} />
              {deleteMode && <span className="post-check">{selectedPosts.includes(post.id) ? "✓" : ""}</span>}
            </button>
          </div>
        )) : <p className="empty">投稿はまだありません</p>}</div>
      </section>

      {nameEditing && (
        <div className="overlay" onClick={() => setNameEditing(false)}>
          <section className="name-edit-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setNameEditing(false)}>×</button>
            <h2>表示名を変更</h2>
            <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="表示名" />
            <button className="primary-button" onClick={() => { if (!nameDraft.trim()) return; onUpdateName(nameDraft.trim()); setNameEditing(false); }}>変更を保存</button>
          </section>
        </div>
      )}
    </main>
  );
}
