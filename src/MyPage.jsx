import { useEffect, useState } from "react";
import "./MyPage.css";
import {
  fetchFollowing,
  fetchFollowers,
  fetchRequests,
  sendFollowRequest,
  answerRequestRemote,
  unfollowRemote,
  removeFollowerRemote,
} from "./api";

/* 共通ヘッダー: マイページタイトルを表示する */
function Header({ title, onLogout }) {
  return (
    <header className="topbar">
      <div className="header-spacer" />
      <h1>{title}</h1>
      <div className="header-right">
        <button className="header-logout" onClick={onLogout}>
          ログアウト
        </button>
      </div>
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
  const [follows, setFollows] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [requests, setRequests] = useState([]);

  const reload = async () => {
    try {
      const [a, b, c] = await Promise.all([
        fetchFollowing(),
        fetchFollowers(),
        fetchRequests(),
      ]);
      setFollows(a);
      setFollowers(b);
      setRequests(c);
    } catch (e) {
      console.log("social load error:", e.message);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const sendRequest = async (event) => {
    event.preventDefault();
    try {
      setMessage(await sendFollowRequest(friendId));
      setFriendId("");
    } catch (e) {
      console.log("request error:", e.message);
      setMessage("申請に失敗しました");
    }
  };

  const answerRequest = async (id, accepted) => {
    try {
      await answerRequestRemote(id, accepted);
      setMessage(accepted ? "申請を許可しました" : "申請を拒否しました");
      await reload();
    } catch (e) {
      console.log("answer error:", e.message);
      setMessage("処理に失敗しました");
    }
  };

  const confirmAction = (kind, person) =>
    setConfirmTarget({ kind, id: person.id, name: person.name });
  const cancelAction = () => setConfirmTarget(null);
  const executeAction = async () => {
    if (!confirmTarget) return;
    try {
      if (confirmTarget.kind === "follow")
        await unfollowRemote(confirmTarget.id);
      else await removeFollowerRemote(confirmTarget.id);
      await reload();
    } catch (e) {
      console.log("remove error:", e.message);
      setMessage("処理に失敗しました");
    }
    setConfirmTarget(null);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="social-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <div className="social-modal-header">
          <h2>{type === "follow" ? "フォロー" : "フォロワー"}</h2>
          {type === "follow" ? (
            <button
              className="friend-add-button"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              友達追加
            </button>
          ) : (
            <button
              className="friend-request-button"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              申請確認 {requests.length}
            </button>
          )}
        </div>
        {searchOpen && type === "follow" && (
          <form className="friend-search" onSubmit={sendRequest}>
            <input
              value={friendId}
              onChange={(event) => setFriendId(event.target.value)}
              placeholder="ユーザーIDを検索（例：MG-1234）"
            />
            <button>申請</button>
          </form>
        )}
        {message && <p className="friend-message">{message}</p>}
        {searchOpen && type === "follower" ? (
          <div className="friend-request-list">
            {requests.length ? (
              requests.map((item) => (
                <div className="friend-request-row" key={item.id}>
                  <span className="small-avatar">{item.name[0]}</span>
                  <b>{item.name}</b>
                  <button
                    className="accept"
                    onClick={() => answerRequest(item.id, true)}
                  >
                    許可
                  </button>
                  <button
                    className="reject"
                    onClick={() => answerRequest(item.id, false)}
                  >
                    拒否
                  </button>
                </div>
              ))
            ) : (
              <p className="empty">申請はありません</p>
            )}
          </div>
        ) : (
          <div className="social-list">
            {(type === "follow" ? follows : followers).map((person) => (
              <div className="social-item" key={person.id}>
                <div className="social-item-main">
                  <span className="small-avatar">{person.name[0]}</span>
                  <b>{person.name}</b>
                  {type === "follow" ? (
                    <button
                      className="following-button"
                      onClick={() => confirmAction("follow", person)}
                    >
                      フォロー中
                    </button>
                  ) : (
                    <button
                      className="follower-delete-button"
                      onClick={() => confirmAction("follower", person)}
                    >
                      削除
                    </button>
                  )}
                </div>
                {confirmTarget?.id === person.id && (
                  <div
                    className="social-delete-modal"
                    role="dialog"
                    aria-modal="true"
                  >
                    <p>本当に削除しますか？</p>
                    <div>
                      <button className="confirm" onClick={executeAction}>
                        はい
                      </button>
                      <button className="cancel" onClick={cancelAction}>
                        いいえ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(type === "follow" ? follows : followers).length === 0 && (
              <p className="empty">まだいません</p>
            )}
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
  counts,
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
  const ownPosts = posts.filter((post) => post.userId === account.id);
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
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId],
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
                    ? ["薄味", "やや薄", "普通", "やや濃い", "濃い味"][
                        profile[key] ?? 2
                      ]
                    : ["苦手", "やや苦手", "普通", "やや好き", "好き"][
                        profile[key] ?? 2
                      ]}
                </span>
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="social-counts">
        <button onClick={() => onSocial("follow")}>
          <strong>{counts.following}</strong>
          <span>フォロー</span>
        </button>
        <button onClick={() => onSocial("follower")}>
          <strong>{counts.followers} </strong>
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
        <h3>
          保存した投稿 <span>{saved.length}</span>
        </h3>
        <div>
          {saved.length ? (
            saved.map((post) => (
              <button key={post.id} onClick={() => onOpenSavedPost(post)}>
                <img src={post.image} alt={`${post.location}の保存投稿`} />
              </button>
            ))
          ) : (
            <p className="empty">保存した投稿はまだありません</p>
          )}
        </div>
      </section>

      <section className="own-posts">
        <div className="own-post-header">
          <h3>
            {deleteMode ? (
              "自分の投稿"
            ) : (
              <>
                自分の投稿 <span>{ownPosts.length}</span>
              </>
            )}
          </h3>
          {deleteMode ? (
            <div className="own-delete-actions">
              <button
                className="delete-selected-button"
                onClick={handleDeleteSelected}
                disabled={selectedPosts.length === 0}
              >
                削除
              </button>
              <button className="delete-mode-button" onClick={toggleDeleteMode}>
                キャンセル
              </button>
            </div>
          ) : (
            <button className="delete-mode-button" onClick={toggleDeleteMode}>
              削除
            </button>
          )}
        </div>
        <div>
          {ownPosts.length ? (
            ownPosts.map((post) => (
              <div
                className={`own-post-item ${selectedPosts.includes(post.id) ? "selected" : ""}`}
                key={post.id}
              >
                <button
                  className="own-post-image"
                  onClick={() =>
                    deleteMode ? toggleSelectPost(post.id) : onOpenOwnPost(post)
                  }
                >
                  <img src={post.image} alt={`${post.location}の投稿`} />
                  {deleteMode && (
                    <span className="post-check">
                      {selectedPosts.includes(post.id) ? "✓" : ""}
                    </span>
                  )}
                </button>
              </div>
            ))
          ) : (
            <p className="empty">投稿はまだありません</p>
          )}
        </div>
      </section>

      {nameEditing && (
        <div className="overlay" onClick={() => setNameEditing(false)}>
          <section
            className="name-edit-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setNameEditing(false)}
            >
              ×
            </button>
            <h2>表示名を変更</h2>
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="表示名"
            />
            <button
              className="primary-button"
              onClick={() => {
                if (!nameDraft.trim()) return;
                onUpdateName(nameDraft.trim());
                setNameEditing(false);
              }}
            >
              変更を保存
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
