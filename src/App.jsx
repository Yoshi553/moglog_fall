/*
 * =====================================================================
 * App.jsx ― アプリ全体の親コンポーネント（画面の切り替えとデータ管理の中心）
 * =====================================================================
 *
 * 【役割】
 * - ログイン状態（account）と、今どの画面を出すか（screen / tab）を管理する
 * - 投稿一覧（posts）などのデータを、api.js 経由でSupabaseから読み込んで持つ
 * - 子の画面（Home / MyPage）やモーダルへ、データと「操作の関数」を渡す
 *
 * 【ファイルの構成】
 *   1. import
 *   2. 小さな表示部品（Stars / Header）
 *   3. 画面コンポーネント
 *        AuthScreen    … ログイン・新規登録
 *        ProfileSetup  … 好みの設定（初回登録時・編集時）
 *        CreatePost    … 投稿作成
 *   4. モーダル
 *        ProfileModal / MapModal / SavedPostModal
 *   5. App 本体（状態の管理、Supabaseとのやりとり、画面の組み立て）
 *
 * 【画面（screen）の種類】
 *   "auth"   … ログイン画面
 *   "setup"  … 好み設定画面（初回ログイン時／マイページの「編集」から）
 *   "home"   … 通常画面（下のタブ tab で ホーム / マイページ を切り替える）
 *   "create" … 投稿作成画面
 *
 * 【データの流れ】
 *   画面での操作 → App のイベント関数 → api.js → Supabase
 *   Supabase から取った結果 → App の state → 子コンポーネントの表示
 */

/* ───────────────────────────────────────────────────────────
 * 1. import
 * ─────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
// exifr … 写真のメタデータ（撮影位置のGPS情報）を読み取る
import exifr from "exifr";
import "./Common.css";
// 地図表示（LocationMap）、座標から住所名を出す部品、座標から市区町村名を取る関数
import LocationMap, {
  ReverseLocationName,
  getCityName,
} from "./LocationMap.jsx";
// heic-to … iPhoneのHEIC形式の写真を、ブラウザで扱えるJPEGに変換する
import { heicTo } from "heic-to";
import Home from "./Home.jsx";
import MyPage, { SocialListModal } from "./MyPage.jsx";
import { supabase } from "./supabase";
// 登録・ログインの処理（auth.js）
import { register, login } from "./auth";
// 投稿・保存・コメント・人数取得など、Supabaseとのやりとり（api.js）
import {
  fetchPosts,
  fetchCounts,
  createPostRemote,
  toggleSaveRemote,
  addCommentRemote,
  deletePostRemote,
} from "./api";

/* ───────────────────────────────────────────────────────────
 * 2. 小さな表示部品
 * ─────────────────────────────────────────────────────────── */

/* 星評価を「⭐️ 数値」の形で表示する（SavedPostModal で使用） */
function Stars({ value, size = "normal" }) {
  return (
    <span className={`stars ${size}`} aria-label={`評価 ${value}`}>
      ⭐️ {value}
    </span>
  );
}

/*
 * 画面上部の共通ヘッダー
 *   title  … 中央に出すタイトル
 *   right  … 右側に置く要素（例: 「＋ 投稿」ボタン）
 *   onBack … 渡すと左に戻るボタン「‹」を表示する。なければ空白で位置をそろえる
 */
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

/* ───────────────────────────────────────────────────────────
 * 3. 画面コンポーネント
 * ─────────────────────────────────────────────────────────── */

/*
 * ログインと新規登録を切り替える画面
 *   onLogin … ログインや登録に成功したとき、App に account を渡して呼ぶ
 *
 * mode は "login"（ログイン）か "register"（新規登録）。
 * 新規登録では表示名とパスワードを入力し、ユーザーID（MG-xxxx）は自動で発行される。
 * ログインでは、ユーザーIDとパスワードを入力する。
 */
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");

  // 送信ボタンを押したときの処理
  const submit = async (event) => {
    // フォーム送信によるページの再読み込みを止める
    event.preventDefault();
    setError("");

    try {
      if (mode === "register") {
        // 入力チェック（Supabase Auth のパスワードは6文字以上が必要）
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
      // 失敗の詳細は見せず、モードに合わせた一般的なメッセージにする
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
      <p className="tagline">「ほんとう」を記録しよう</p>
      <form className="auth-card" onSubmit={submit}>
        {/* モードに応じて入力欄を出し分ける */}
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
        {/* ログインと新規登録を切り替えるリンク */}
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

/*
 * 好みの設定画面（初回ログイン時と、マイページの「編集」から開いたとき）
 *   account … 現在のユーザー。すでに好みがあれば、その値を初期表示にする
 *   onSave  … 「保存して完了」を押したとき、入力内容を渡して呼ぶ
 *
 * 辛さ・甘さ・濃さは、それぞれ0〜4の5段階で選ぶ。
 *   辛さ・甘さ: 0 苦手 / 1 やや苦手 / 2 普通 / 3 やや好き / 4 好き
 *   濃さ      : 0 薄味 / 1 やや薄 / 2 普通 / 3 やや濃い / 4 濃い味
 */
function ProfileSetup({ account, onSave }) {
  const [foods, setFoods] = useState(account.profile?.favoriteFoods || "");
  // 初期値は、設定済みならその値、初回なら「普通」（濃さは1）
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
            placeholder="例：ラーメン、カレー"
          />
        </label>
        {/* 辛さ・甘さ・濃さの3項目を、同じ形のボタン列として並べる */}
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

/*
 * 投稿作成画面
 *   account  … 現在のユーザー
 *   onCancel … 戻るボタン。ホームへ戻る
 *   onCreate … 「投稿する」を押したとき、投稿内容を渡して呼ぶ
 *
 * 写真を選ぶと、次の順に処理する。
 *   ① 写真のGPS情報を読み取り、あれば地図にピンを置く（なければ地図をタップして設定）
 *   ② HEIC形式ならJPEGに変換する
 *   ③ 最大1200pxに縮小し、JPEGに圧縮して画面に表示する
 */
function CreatePost({ account, onCancel, onCreate }) {
  const [image, setImage] = useState(""); // 圧縮済みの写真（data URL）
  const [location, setLocation] = useState(""); // 店名
  const [city, setCity] = useState(""); // 市区町村
  const [rating, setRating] = useState(0); // 星評価（0〜5、0.5刻み）
  const [comment, setComment] = useState("");
  const [gps, setGps] = useState(null); // 位置情報 { latitude, longitude }
  const [pin, setPin] = useState(null); // 地図上のピンの位置
  const [locationStatus, setLocationStatus] =
    useState("写真を選ぶと位置情報を確認できます");

  // 地図をタップ／ピンをドラッグしたときに、位置と市区町村を更新する
  const selectPosition = async (position) => {
    setPin(position);
    setGps(position);
    setLocationStatus(
      "位置情報が設定されています。ピンをドラッグして調整できます。",
    );
    setCity(await getCityName(position));
  };

  // 写真が選ばれたときの処理
  const chooseImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ① 写真に埋め込まれた位置情報（GPS）を読み取る
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
        // GPSがない写真: 地図をタップして手動で設定してもらう
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

    // ② HEIC / HEIF 形式かどうかを、拡張子とファイルの種類の両方で判定する
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

    // ③ 写真を読み込む
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        // canvas に縮小して描き、JPEGとして書き出す
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

  // 「投稿する」を押したときの処理。写真がなければ何もしない
  // 渡した内容を、App の createPost が受け取ってSupabaseへ保存する
  const submit = () => {
    if (!image) return;
    onCreate({
      id: `p-${Date.now()}`,
      userId: account.userId,
      name: account.name,
      avatar: account.name[0] || "も",
      rating,
      image,
      location: location || "",
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
        {/* 写真の選択。選ぶとプレビューに切り替わる */}
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
            placeholder="例：くら寿司"
          />
        </label>
        <label>
          市区町村（任意）
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="例： 茨城県つくば市天久保"
          />
        </label>
        {/* 位置情報: 取得状況のメッセージ、座標、住所、調整用の地図 */}
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
        {/* 星評価: 0〜5を0.5刻みの点で並べ、押した点までを選択状態にする */}
        <div className="rating-picker">
          <b>評価</b>
          <p>0〜5まで0.5刻みで選択</p>
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
        <div className="create-buttons">
          <button className="create-cancel-button" onClick={onCancel}>
            キャンセル
          </button>
          <button className="create-submit-button" onClick={submit}>
            投稿する
          </button>
        </div>
      </section>
    </main>
  );
}

/* ───────────────────────────────────────────────────────────
 * 4. モーダル（画面の上に重ねて表示する小窓）
 *    どれも、外側の暗い部分（overlay）を押すと閉じる。
 *    中身を押したときに閉じないよう、stopPropagation で伝わりを止めている。
 * ─────────────────────────────────────────────────────────── */

/*
 * 投稿者のプロフィール詳細（ホームで投稿者の名前を押すと開く）
 *   post … 押された投稿。post.profile に、投稿者の好みが入っている
 * ユーザーID（MG-xxxx）は他人に見せないので、表示しない。
 */
function ProfileModal({ post, onClose }) {
  // プロフィールがない場合の仮の表示内容
  const profile = post.profile || {
    favoriteFoods: "ラーメン・スイーツ",
    辛さ: 2,
    甘さ: 3,
    濃さ: 1,
  };
  // 数値（0〜4）を言葉に変えるための一覧
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
        {/* 辛さ・甘さ・濃さを横3列で表示（CSSの .profile-preference-grid） */}
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

/* 投稿の場所を大きな地図で表示するモーダル（店名や住所をタイトルに出す） */
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

/*
 * 投稿の詳細モーダル（マイページで、保存した投稿／自分の投稿を押すと開く）
 *   post        … 表示する投稿
 *   onComment   … コメントを送るときに呼ぶ
 *   accountName … 自分の表示名。自分のコメントを右側に表示するために使う
 *   onSave      … 保存ボタンを押したときに呼ぶ
 *
 * 下の3つのボタンで、表示内容を切り替える。
 *   💬 … コメント一覧と入力欄 / 📍 … 地図 / 📁 … 保存・保存解除
 *   （同じボタンをもう一度押すと、本文の表示に戻る）
 */
function SavedPostModal({ post, onClose, onComment, accountName, onSave }) {
  // 今何を表示しているか: "photo"（本文）/ "comment" / "map"
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
          {/* 本文 */}
          {activeAction === "photo" && (
            <p className="saved-photo-comment">
              {post.comment || "コメントはありません"}
            </p>
          )}
          {/* コメント一覧。自分のコメントは右（mine）、他の人は左（other） */}
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
          {/* 地図 */}
          {activeAction === "map" && (
            <div className="inline-place">
              <b>
                <ReverseLocationName post={post} />
              </b>
              <LocationMap post={post} className="inline-location-map" />
            </div>
          )}
        </div>
        {/* 下部の切り替えボタン */}
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

/* ───────────────────────────────────────────────────────────
 * 5. App 本体
 * ─────────────────────────────────────────────────────────── */
function App() {
  /*
   * ── 状態（state）の一覧 ──
   *   account   … 現在ログイン中のユーザー { id, userId, name, profile }
   *               再読み込み後もログイン状態を保てるよう、localStorage の
   *               moglog_current にも保存している
   *   screen    … 表示する画面（"auth" / "setup" / "home" / "create"）
   *   tab       … 通常画面での下タブ（"home" / "mypage"）
   *   posts     … 見える投稿の一覧（Supabaseから読み込む）
   *   modalPost … プロフィールモーダルの対象の投稿
   *   mapPost   … 地図モーダルの対象の投稿
   *   savedPost … 投稿詳細モーダルの対象の投稿
   *   socialType… フォロー一覧モーダルの種類（"follow" / "follower"）
   *   toast     … 画面下に一時的に出す通知文
   */
  const [account, setAccount] = useState(() =>
    JSON.parse(localStorage.getItem("moglog_current") || "null"),
  );
  // 起動時の画面: ログイン済みなら（好み設定が済んでいれば）ホーム、なければ好み設定。未ログインならログイン画面
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

  // 投稿一覧をSupabaseから読み込んで、posts に入れる
  const loadPosts = async () => {
    try {
      setPosts(await fetchPosts());
    } catch (e) {
      console.log("load posts error:", e.message);
    }
  };

  // マイページに出すフォロー数・フォロワー数
  const [counts, setCounts] = useState({ following: 0, followers: 0 });

  // 人数をSupabaseから読み込んで、counts に入れる
  const loadCounts = async () => {
    try {
      setCounts(await fetchCounts());
    } catch (e) {
      console.log("load counts error:", e.message);
    }
  };

  // ログインしたとき（ユーザーが切り替わったとき）に、投稿と人数を読み込む
  useEffect(() => {
    if (account) {
      loadPosts();
      loadCounts();
    }
  }, [account?.userId]);

  // ログインまたは登録に成功したときの処理
  // アカウントを覚え、好み設定が済んでいればホーム、まだなら好み設定画面へ進む
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

    // 保存できたら、画面側のアカウント情報も更新してホームへ進む
    const next = { ...account, profile };
    setAccount(next);
    localStorage.setItem("moglog_current", JSON.stringify(next));
    setScreen("home");
  };

  // 表示名をSupabaseのprofilesへ保存する（マイページの「プロフィール編集」から）
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

  // 保存 / 保存解除を切り替える
  const toggleSave = async (id) => {
    const target = posts.find((p) => p.id === id);
    if (!target) return;
    const nextSaved = !target.saved;

    // 先に画面を更新し、失敗したら元に戻す（反応を速く見せるため）
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

  // コメントを追加する。Supabaseへの保存に成功してから、画面の一覧にも足す
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

  // 投稿者のプロフィールモーダルを開く
  // 投稿にプロフィールが入っていればそれを使い、なければ（自分の投稿のときだけ）自分のプロフィールを使う
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

  // 投稿を作成する。保存できたら一覧を読み込み直して、ホームへ戻る
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

  // 投稿を削除する。Supabaseで消せたら、画面の一覧からも外し、詳細モーダルも閉じる
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

  /* ── 画面の切り替え ──
   * screen が auth ならログイン画面、setup なら好み設定だけを表示する。
   * （ここで return するので、下の通常画面は描画されない）
   */
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
            // ユーザーIDをコピーしたとき、1.8秒だけ通知を出す
            setToast("ユーザーIDをコピーしました");
            setTimeout(() => setToast(""), 1800);
          }}
          onSocial={setSocialType}
          onDeletePost={deletePost}
          onLogout={logout}
        />
      )}

      {/* 下部ナビ。投稿作成画面では出さない */}
      {screen !== "create" && (
        <nav className="bottom-nav">
          <button
            className={tab === "home" ? "active" : ""}
            onClick={() => {
              // すでにホーム画面を見ている場合は、一番上までスクロールして戻る
              if (tab === "home" && screen === "home") {
                window.scrollTo({ top: 0, behavior: "smooth" });
                document
                  .querySelector(".home-screen")
                  ?.scrollTo({ top: 0, behavior: "smooth" });
                return;
              }

              // 別のタブや画面にいる場合は、これまで通りホームへ切り替える
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

      {/* ── モーダル。対象のstateが入っているときだけ表示する ── */}
      {modalPost && (
        <ProfileModal post={modalPost} onClose={() => setModalPost(null)} />
      )}
      {mapPost && <MapModal post={mapPost} onClose={() => setMapPost(null)} />}
      {savedPost && (
        <SavedPostModal
          // 開いたあとにコメントや保存が変わっても反映されるよう、最新の投稿を探して渡す
          post={posts.find((p) => p.id === savedPost.id) || savedPost}
          onClose={() => setSavedPost(null)}
          onComment={addComment}
          accountName={account?.name}
          onSave={(id) => {
            const target = posts.find((post) => post.id === id);
            toggleSave(id);
            // 保存を外したときは、保存一覧から消えるのでモーダルも閉じる
            if (target?.saved) setSavedPost(null);
          }}
        />
      )}
      {socialType && (
        <SocialListModal
          type={socialType}
          onClose={() => {
            setSocialType(null);
            // フォロー関係が変わった可能性があるので、人数と投稿一覧を読み込み直す
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
