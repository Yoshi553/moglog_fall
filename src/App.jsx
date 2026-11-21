import { useEffect, useState } from "react";
import exifr from "exifr";
import "./Common.css";
import LocationMap, {
  ReverseLocationName,
  getCityName,
} from "./LocationMap.jsx";
import { heicTo } from "heic-to";
import Home from "./Home.jsx";
import MyPage, { SocialListModal } from "./MyPage.jsx";
import { supabase } from "./supabase";
import { register, login } from "./auth";
import {
  fetchPosts,
  fetchCounts,
  createPostRemote,
  toggleSaveRemote,
  addCommentRemote,
  deletePostRemote,
} from "./api";



/* コンポーネント: 画面上部の共通ヘッダー */
function Header({ title, right, onBack }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-button back" onClick={onBack}>
          ‹
        </button>
      ) : (
        <div className="header-spacer" />
      )}
      <h1>{title}</h1>
      <div className="header-right">{right}</div>
    </header>
  );
}

/* ログインと新規登録を切り替える画面 */
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      if (mode === "register") {
        if (!name.trim() || !password.trim())
          return setError("表示名とパスワードを入力してください");
        if (password.length < 6)
          return setError("パスワードは6文字以上にしてください");
        const account = await register(name.trim(), password);
        onLogin(account);
        return;
      }

      const account = await login(userId, password);
      onLogin(account);
    } catch {
      setError(
        mode === "register"
          ? "登録に失敗しました"
          : "ユーザーIDまたはパスワードが違います",
      );
    }
  };

  return (
    <main className="auth-screen">
      <div className="brand-mark">
        <span>もぐ</span>
        <span>ろぐ</span>
      </div>
      <h1 className="brand-name">もぐろぐ</h1>
      <p className="tagline">おいしいを記録しよう</p>
      <form className="auth-card" onSubmit={submit}>
        {mode === "register" ? (
          <>
            <label>
              表示名
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：はるこ"
              />
            </label>
            <label>
              パスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="好きなパスワード"
              />
            </label>
          </>
        ) : (
          <>
            <label>
              ユーザーID
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="MG-1234"
              />
            </label>
            <label>
              パスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード"
              />
            </label>
          </>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">
          {mode === "register" ? "はじめる" : "ログイン"}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "初めての方はこちら" : "すでにアカウントがある方"}
        </button>
      </form>
    </main>
  );
}

/* 初回ログイン時の好み設定。濃さは薄味・普通・濃い味の3段階 */
function ProfileSetup({ account, onSave }) {
  const [foods, setFoods] = useState(account.profile?.favoriteFoods || "");
  const [preferences, setPreferences] = useState(
    account.profile
      ? {
          辛さ: account.profile["辛さ"] ?? 2,
          甘さ: account.profile["甘さ"] ?? 2,
          濃さ: account.profile["濃さ"] ?? 1,
        }
      : { 辛さ: 2, 甘さ: 2, 濃さ: 1 },
  );
  const save = () => onSave({ favoriteFoods: foods, ...preferences });

  return (
    <main className="setup-screen">
      <div className="setup-illustration">🍽️</div>
      <h1>あなたの好みは？？</h1>
      <p className="setup-subtitle">
        あなたの投稿が他の人の参考になりやすくなります。
      </p>
      <section className="profile-form">
        <label>
          好きな食べ物 <span>任意</span>
          <input
            value={foods}
            onChange={(e) => setFoods(e.target.value)}
            placeholder="例：ラーメン"
          />
        </label>
        {["辛さ", "甘さ", "濃さ"].map((key) => (
          <div className="scale-row" key={key}>
            <b>{key}の好み</b>
            <div
              className={
                key === "濃さ"
                  ? "scale-options strength-options"
                  : "scale-options"
              }
            >
              {(key === "濃さ" ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4]).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    className={preferences[key] === value ? "selected" : ""}
                    onClick={() =>
                      setPreferences((old) => ({ ...old, [key]: value }))
                    }
                  >
                    <span>
                      {key === "濃さ"
                        ? ["薄味", "やや薄", "普通", "やや濃い", "濃い味"][
                            value
                          ]
                        : ["苦手", "やや苦手", "普通", "やや好き", "好き"][
                            value
                          ]}
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
        <button className="primary-button" onClick={save}>
          保存して完了
        </button>
      </section>
    </main>
  );
}

/* 投稿作成画面。スマホの写真選択に対応し、場所は店名で入力する */
function CreatePost({ account, onCancel, onCreate }) {
  const [image, setImage] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [gps, setGps] = useState(null);
  const [pin, setPin] = useState(null);
  const [locationStatus, setLocationStatus] =
    useState("写真を選ぶと位置情報を確認できます");

  const selectPosition = async (position) => {
    setPin(position);
    setGps(position);
    setLocationStatus(
      "位置情報が設定されています。ピンをドラッグして調整できます。",
    );
    setCity(await getCityName(position));
  };

  const chooseImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const position = await exifr.gps(file);
      if (position?.latitude != null && position?.longitude != null) {
        const photoPosition = {
          latitude: position.latitude,
          longitude: position.longitude,
        };
        setGps(photoPosition);
        setPin(photoPosition);
        setCity(await getCityName(photoPosition));
        setLocationStatus(
          "写真から位置情報を取得しました。ピンをドラッグして調整できます。",
        );
      } else {
        setGps(null);
        setPin(null);
        setCity("");
        setLocationStatus(
          "この写真には位置情報がありません。地図をタップしてピンを設定できます。",
        );
      }
    } catch {
      setGps(null);
      setPin(null);
      setCity("");
      setLocationStatus(
        "位置情報を読み取れませんでした。地図をタップしてピンを設定できます。",
      );
    }

    let uploadFile = file;

    const isHeic =
      /\.hei(c|f)$/i.test(file.name) ||
      file.type === "image/heic" ||
      file.type === "image/heif";

    // HEICをJPEGに変換
    if (isHeic) {
      try {
        uploadFile = await heicTo({
          blob: file,
          type: "image/jpeg",
          quality: 0.92,
        });
      } catch {
        alert(
          "HEIC写真をJPEGに変換できませんでした。JPEG形式でアップロードしてください。",
        );
        return;
      }
    }

    // 写真を読み込む
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");

        // 最大サイズを1200pxにする
        const maxSize = 1200;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // JPEG形式に圧縮
        const compressedImage = canvas.toDataURL("image/jpeg", 0.7);

        setImage(compressedImage);
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(uploadFile);
  };

  const submit = () => {
    if (!image) return;
    onCreate({
      id: `p-${Date.now()}`,
      userId: account.userId,
      name: account.name,
      avatar: account.name[0] || "も",
      rating,
      image,
      location: location || "場所未設定",
      city,
      comment,
      comments: [],
      saved: false,
      gps,
      pin,
    });
  };

  return (
    <main className="create-screen">
      <Header title="投稿作成" onBack={onCancel} />
      <section className="create-form">
        <label className="photo-picker">
          {image ? (
            <img src={image} alt="選択した写真" />
          ) : (
            <>
              <span>📷</span>
              <b>写真を選ぶ</b>
            </>
          )}
          <input
            type="file"
            accept="image/*,.heic,.heif"
            onChange={chooseImage}
          />
        </label>
        <label>
          店名（任意）
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例：俺の生きる道"
          />
        </label>
        <label>
          市区町村（任意）
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="例：渋谷区"
          />
        </label>
        <div className="location-picker">
          <b>位置情報</b>
          <p className="location-message">{locationStatus}</p>
          {gps && (
            <>
              <small className="gps-coordinate">
                緯度 {gps.latitude.toFixed(6)} / 経度 {gps.longitude.toFixed(6)}
              </small>
              <small className="reverse-address">
                <ReverseLocationName
                  post={{ location, gps }}
                  position={pin}
                  fallback="住所を取得中..."
                />
              </small>
            </>
          )}
          <div
            className="leaflet-location-map"
            aria-label="地図上のピン。タップまたはドラッグで位置を変更できます"
          >
            <LocationMap
              position={pin}
              editable
              onPositionChange={selectPosition}
              className="create-location-map"
            />
          </div>
        </div>
        <div className="rating-picker">
          <b>評価</b>
          <p>0~5まで0.5刻みで選択</p>
          <div
            className="rating-line"
            aria-label="評価を0から5まで0.5刻みで選択"
          >
            {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={`rating-dot ${n % 1 === 0 ? "integer" : "half"} ${n <= rating ? "selected" : ""}`}
                onClick={() => setRating(n)}
                aria-label={`${n}`}
              >
                <span />
              </button>
            ))}
          </div>
          <div className="rating-scale">
            <span></span>
            <strong>⭐️{rating} / 5</strong>
            <span></span>
          </div>
        </div>
        <label>
          コメント(任意)
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows="5"
            placeholder="みんなに感想を伝えましょう。"
          />
        </label>
        <button className="create-submit-button" onClick={submit}>
          投稿する
        </button>
      </section>
    </main>
  );
}

/* プロフィール詳細。友達のユーザーIDは表示しない */
function ProfileModal({ post, onClose }) {
  const profile = post.profile || {
    favoriteFoods: "ラーメン・スイーツ",
    辛さ: 2,
    甘さ: 3,
    濃さ: 1,
  };
  const preferenceLabels = {
    辛さ: ["苦手", "やや苦手", "普通", "やや好き", "好き"],
    甘さ: ["苦手", "やや苦手", "普通", "やや好き", "好き"],
    濃さ: ["薄味", "やや薄味", "普通", "やや濃い味", "濃い味"],
  };
  return (
    <div className="overlay" onClick={onClose}>
      <section className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <span className="large-avatar">{post.avatar}</span>
        <h2>{post.name}</h2>
        <h3>好きな食べ物</h3>
        <p>{profile.favoriteFoods || "未設定"}</p>
        <div className="profile-preference-grid">
          {["辛さ", "甘さ", "濃さ"].map((key) => (
            <div key={key}>
              <b>{key}</b>
              <span>{preferenceLabels[key][profile[key] ?? 2]}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MapModal({ post, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <section className="map-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <h2>
          <ReverseLocationName post={post} />
        </h2>
        <LocationMap post={post} className="big-location-map" />
      </section>
    </div>
  );
}

/* 保存投稿詳細。保存した投稿をタップすると内容全体を確認できる */
function SavedPostModal({ post, onClose, onComment, accountName, onSave }) {
  const [activeAction, setActiveAction] = useState("photo");
  const [comment, setComment] = useState("");
  const addComment = (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    onComment(post.id, comment.trim());
    setComment("");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <section
        className={`saved-detail-modal`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <img src={post.image} alt={post.location} />
        <div className="saved-detail-copy">
          <b>{post.name}</b>
          <Stars value={post.rating} />
          <h3>
            <ReverseLocationName post={post} />
          </h3>
          {activeAction === "photo" && (
            <p className="saved-photo-comment">
              {post.comment || "コメントはありません"}
            </p>
          )}
          {activeAction === "comment" && (
            <div className="comments-panel">
              {post.comments.map((item, index) => {
                const isMine = item.name === accountName;
                return (
                  <div
                    className={`chat-row ${isMine ? "mine" : "other"}`}
                    key={index}
                  >
                    <span className="chat-avatar">⚪</span>
                    <div className="chat-bubble">
                      <b>{item.name}</b>
                      <span>{item.text}</span>
                    </div>
                  </div>
                );
              })}
              {post.comments.length === 0 && (
                <p className="no-comments">まだコメントはありません</p>
              )}
              <form className="comment-form" onSubmit={addComment}>
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="コメントを書く"
                />
                <button>送信</button>
              </form>
            </div>
          )}
          {activeAction === "map" && (
            <div className="inline-place">
              <b>
                <ReverseLocationName post={post} />
              </b>
              <LocationMap post={post} className="inline-location-map" />
            </div>
          )}
        </div>
        <div className="saved-actions">
          <button
            className={activeAction === "comment" ? "active-action" : ""}
            onClick={() =>
              setActiveAction((current) =>
                current === "comment" ? "photo" : "comment",
              )
            }
          >
            💬
          </button>
          <button
            className={activeAction === "map" ? "active-action" : ""}
            onClick={() =>
              setActiveAction((current) =>
                current === "map" ? "photo" : "map",
              )
            }
          >
            📍
          </button>
          <button
            className={post.saved ? "active-save-action" : ""}
            onClick={() => onSave(post.id)}
            aria-label="保存"
          >
            📁
          </button>
        </div>
      </section>
    </div>
  );
}

function App() {
  const [account, setAccount] = useState(() =>
    JSON.parse(localStorage.getItem("moglog_current") || "null"),
  );
  const [screen, setScreen] = useState(
    account ? (account.profile ? "home" : "setup") : "auth",
  );
  const [tab, setTab] = useState("home");
  const [posts, setPosts] = useState([]);
  const [modalPost, setModalPost] = useState(null);
  const [mapPost, setMapPost] = useState(null);
  const [savedPost, setSavedPost] = useState(null);
  const [socialType, setSocialType] = useState(null);
  const [toast, setToast] = useState("");

  const loadPosts = async () => {
    try {
      setPosts(await fetchPosts());
    } catch (e) {
      console.log("load posts error:", e.message);
    }
  };

  const [counts, setCounts] = useState({ following: 0, followers: 0 });

  const loadCounts = async () => {
    try {
      setCounts(await fetchCounts());
    } catch (e) {
      console.log("load counts error:", e.message);
    }
  };

  useEffect(() => {
    if (account) {
      loadPosts();
      loadCounts();
    }
  }, [account?.userId]);

  const login = (nextAccount) => {
    setAccount(nextAccount);
    localStorage.setItem("moglog_current", JSON.stringify(nextAccount));
    setScreen(nextAccount.profile ? "home" : "setup");
  };

  // 好み設定をSupabaseのprofilesへ保存する
  const saveProfile = async (profile) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({
        favorite_foods: profile.favoriteFoods,
        spicy_pref: profile["辛さ"],
        sweet_pref: profile["甘さ"],
        strength_pref: profile["濃さ"],
      })
      .eq("id", user.id);

    if (error) {
      console.log("profile save error:", error.message);
      alert("好みの保存に失敗しました");
      return;
    }

    const next = { ...account, profile };
    setAccount(next);
    localStorage.setItem("moglog_current", JSON.stringify(next));
    setScreen("home");
  };

  // 表示名をSupabaseのprofilesへ保存する
  const updateName = async (name) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", user.id);

    if (error) {
      console.log("name update error:", error.message);
      alert("表示名の変更に失敗しました");
      return;
    }

    const next = { ...account, name };
    setAccount(next);
    localStorage.setItem("moglog_current", JSON.stringify(next));
  };

  const toggleSave = async (id) => {
    const target = posts.find((p) => p.id === id);
    if (!target) return;
    const nextSaved = !target.saved;

    // 先に画面を更新し、失敗したら元に戻す
    setPosts((old) =>
      old.map((p) => (p.id === id ? { ...p, saved: nextSaved } : p)),
    );
    try {
      await toggleSaveRemote(id, nextSaved);
    } catch (e) {
      console.log("save error:", e.message);
      setPosts((old) =>
        old.map((p) => (p.id === id ? { ...p, saved: !nextSaved } : p)),
      );
      alert("保存に失敗しました");
    }
  };

  const addComment = async (id, text) => {
    try {
      await addCommentRemote(id, text);
    } catch (e) {
      console.log("comment error:", e.message);
      alert("コメントの送信に失敗しました");
      return;
    }
    setPosts((old) =>
      old.map((p) =>
        p.id === id
          ? { ...p, comments: [...p.comments, { name: account.name, text }] }
          : p,
      ),
    );
  };

  const openProfile = (post) =>
    setModalPost(
      post.profile
        ? post
        : {
            ...post,
            profile:
              account.profile && post.userId === account.id
                ? account.profile
                : post.profile,
          },
    );

  const createPost = async (post) => {
    try {
      await createPostRemote(post);
      await loadPosts();
      setScreen("home");
      setTab("home");
    } catch (e) {
      console.log("create post error:", e.message);
      alert("投稿に失敗しました");
    }
  };

  const deletePost = async (postId) => {
    const target = posts.find((p) => p.id === postId);
    if (!target) return;
    try {
      await deletePostRemote(target);
    } catch (e) {
      console.log("delete post error:", e.message);
      alert("削除に失敗しました");
      return;
    }
    setPosts((old) => old.filter((p) => p.id !== postId));
    setSavedPost(null);
  };
  // logout：Supabaseのセッションを切り、アカウント状態とタブをリセットしてログイン画面へ戻す。
  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("moglog_current");
    setAccount(null);
    setTab("home");
    setScreen("auth");
  };

  /*
   * App（アプリ全体の親コンポーネント）
   * accountは現在ログイン中のユーザー。moglog_currentへ保存し、再読み込み時にログイン状態を復元する。
   * screenはログイン、好み設定、通常画面、投稿作成を切り替え、tabはホーム／マイページを切り替える。
   * postsは全投稿配列。moglog_postsへ保存し、コメント追加・保存切り替え・投稿削除で配列を更新する。
   * modalPost・savedPost・mapPost・socialTypeはそれぞれプロフィール・保存投稿・地図・フォロー一覧モーダルの対象を保持する。
   */

  // screenがauthならログイン画面、setupなら初回好み設定だけを表示する。
  if (screen === "auth") return <AuthScreen onLogin={login} />;
  if (screen === "setup")
    return <ProfileSetup account={account} onSave={saveProfile} />;

  // 通常画面では投稿作成・ホーム・マイページを同じapp-shell内へ描画し、下部ナビで切り替える。
  return (
    <div className="app-shell">
      {screen === "create" ? (
        <CreatePost
          account={account}
          onCancel={() => setScreen("home")}
          onCreate={createPost}
        />
      ) : tab === "home" ? (
        <Home
          posts={posts}
          onSave={toggleSave}
          onComment={addComment}
          onProfile={openProfile}
          onMap={setMapPost}
          onCreate={() => setScreen("create")}
          accountName={account?.name}
        />
      ) : (
        <MyPage
          account={account}
          posts={posts}
          counts={counts}
          onEditProfile={() => setScreen("setup")}
          onEditPreferences={() => setScreen("setup")}
          onUpdateName={updateName}
          onOpenSavedPost={setSavedPost}
          onOpenOwnPost={setSavedPost}
          onCopyId={() => {
            setToast("ユーザーIDをコピーしました");
            setTimeout(() => setToast(""), 1800);
          }}
          onSocial={setSocialType}
          onDeletePost={deletePost}
          onLogout={logout}
        />
      )}

      {screen !== "create" && (
        <nav className="bottom-nav">
          <button
            className={tab === "home" ? "active" : ""}
            onClick={() => {
              setTab("home");
              setScreen("home");
            }}
          >
            <span>⌂</span>
            <small>ホーム</small>
          </button>
          <button
            className={tab === "mypage" ? "active" : ""}
            onClick={() => {
              setTab("mypage");
              setScreen("home");
            }}
          >
            <span>♙</span>
            <small>マイページ</small>
          </button>
        </nav>
      )}

      {modalPost && (
        <ProfileModal post={modalPost} onClose={() => setModalPost(null)} />
      )}
      {mapPost && <MapModal post={mapPost} onClose={() => setMapPost(null)} />}
      {savedPost && (
        <SavedPostModal
          post={posts.find((p) => p.id === savedPost.id) || savedPost}
          onClose={() => setSavedPost(null)}
          onComment={addComment}
          accountName={account?.name}
          onSave={(id) => {
            const target = posts.find((post) => post.id === id);
            toggleSave(id);
            if (target?.saved) setSavedPost(null);
          }}
        />
      )}
      {socialType && (
        <SocialListModal
          type={socialType}
          onClose={() => {
            setSocialType(null);
            loadCounts();
            loadPosts();
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
