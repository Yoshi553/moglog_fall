// ReactからuseEffectとuseStateを読み込む。
// useState：画面の状態（入力内容、モーダルの表示状態など）を管理する。
// useEffect：画面が表示されたときなど、特定のタイミングで処理を実行する。
import { useEffect, useState } from "react";

// マイページ専用のCSSを読み込む。
import "./MyPage.css";

// api.jsから、フォロー・フォロワー・フォロー申請に関する
// データ取得やデータ更新の関数を読み込む。
// これらの関数を通してデータベースとの通信を行う。
import {
  fetchFollowing,       // 自分がフォローしているユーザー一覧を取得
  fetchFollowers,       // 自分のフォロワー一覧を取得
  fetchRequests,        // 届いているフォロー申請一覧を取得
  sendFollowRequest,    // 指定したユーザーにフォロー申請を送信
  answerRequestRemote,  // 届いたフォロー申請を許可・拒否
  unfollowRemote,       // 自分がフォローしているユーザーを解除
  removeFollowerRemote, // 自分のフォロワーを削除
} from "./api";


/* =========================================================
   ① 共通ヘッダー
   ========================================================= */

/*
 * Header
 *
 * マイページの上部に表示するヘッダーを作成するコンポーネント。
 *
 * title：ヘッダーに表示するタイトル
 * onLogout：ログアウトボタンを押したときに実行する関数
 *
 * 親コンポーネントから受け取った情報を使って、
 * タイトルとログアウトボタンを表示する。
 */
function Header({ title, onLogout }) {
  return (
    <header className="topbar">

      {/* 左側の余白。タイトルを中央に配置するために使用する。 */}
      <div className="header-spacer" />

      {/* 親コンポーネントから受け取ったタイトルを表示する。 */}
      <h1>{title}</h1>

      {/* ヘッダー右側のログアウトボタン。 */}
      <div className="header-right">
        <button className="header-logout" onClick={onLogout}>
          ログアウト
        </button>
      </div>

    </header>
  );
}


/* =========================================================
   ② フォロー・フォロワー一覧モーダル
   ========================================================= */

/*
 * SocialListModal
 *
 * フォロー中のユーザーやフォロワーの一覧を表示するモーダル。
 *
 * type：
 *   "follow"   → 自分がフォローしているユーザーを表示
 *   "follower" → 自分のフォロワーを表示
 *
 * onClose：
 *   モーダルを閉じるために親コンポーネントから受け取る関数。
 *
 * 主な機能：
 * ・フォロー一覧、フォロワー一覧の取得
 * ・ユーザーIDを使った友達追加（フォロー申請）
 * ・届いたフォロー申請の確認
 * ・フォロー申請の許可・拒否
 * ・フォロー解除
 * ・フォロワー削除
 */
export function SocialListModal({ type, onClose }) {

  // 友達追加フォームやフォロー申請一覧を表示するかどうか。
  // true：表示する、false：表示しない。
  const [searchOpen, setSearchOpen] = useState(false);

  // 友達追加時に入力された相手のユーザーIDを保持する。
  const [friendId, setFriendId] = useState("");

  // 申請結果やエラーなど、画面に表示するメッセージを保持する。
  const [message, setMessage] = useState("");

  // フォロー解除・フォロワー削除の確認対象を保持する。
  // 対象の種類（kind）、ユーザーID（id）、名前（name）を保存する。
  // 何も選択されていない場合はnull。
  const [confirmTarget, setConfirmTarget] = useState(null);

  // 自分がフォローしているユーザーの一覧を保持する。
  const [follows, setFollows] = useState([]);

  // 自分のフォロワーの一覧を保持する。
  const [followers, setFollowers] = useState([]);

  // 自分に届いているフォロー申請の一覧を保持する。
  const [requests, setRequests] = useState([]);


  /*
   * reload
   *
   * フォロー・フォロワー・フォロー申請の情報を
   * データベースから取得し直す関数。
   *
   * Promise.allを使用することで、3種類のデータを
   * 並行して取得する。
   *
   * 取得したデータは、それぞれのstateに保存する。
   *
   * 例えば、フォロー解除後にreloadを実行すると、
   * 更新されたフォロー一覧を画面に反映できる。
   */
  const reload = async () => {
    try {

      // 3つのAPI通信を同時に実行し、すべての結果を待つ。
      const [a, b, c] = await Promise.all([
        fetchFollowing(), // フォロー一覧を取得
        fetchFollowers(), // フォロワー一覧を取得
        fetchRequests(),  // フォロー申請一覧を取得
      ]);

      // 取得したデータをそれぞれのstateに保存する。
      setFollows(a);
      setFollowers(b);
      setRequests(c);

    } catch (e) {

      // データ取得に失敗した場合は、エラー内容をコンソールに表示する。
      console.log("social load error:", e.message);
    }
  };


  /*
   * useEffect
   *
   * SocialListModalが最初に画面に表示されたときに、
   * reloadを実行する。
   *
   * 第2引数の[]は依存配列。
   * 空配列にすることで、基本的に初回表示時のみ実行する。
   */
  useEffect(() => {
    reload();
  }, []);


  /*
   * sendRequest
   *
   * 入力されたユーザーIDを使ってフォロー申請を送信する。
   *
   * event.preventDefault()
   * フォーム送信時にページが再読み込みされるのを防ぐ。
   */
  const sendRequest = async (event) => {

    // フォームの通常の送信動作をキャンセルする。
    event.preventDefault();

    try {

      // 入力されたユーザーIDをAPIに渡してフォロー申請を送信する。
      // APIから返された結果をメッセージとして保存する。
      setMessage(await sendFollowRequest(friendId));

      // 申請後、入力欄を空にする。
      setFriendId("");

    } catch (e) {

      // 申請に失敗した場合はエラーをコンソールに表示する。
      console.log("request error:", e.message);

      // 画面にエラーメッセージを表示する。
      setMessage("申請に失敗しました");
    }
  };


  /*
   * answerRequest
   *
   * 届いたフォロー申請を許可するか拒否する関数。
   *
   * id：
   *   処理対象となるフォロー申請のID。
   *
   * accepted：
   *   true  → 申請を許可する
   *   false → 申請を拒否する
   */
  const answerRequest = async (id, accepted) => {
    try {

      // APIを通してフォロー申請の状態を更新する。
      await answerRequestRemote(id, accepted);

      // 許可・拒否の結果に応じたメッセージを表示する。
      setMessage(accepted ? "申請を許可しました" : "申請を拒否しました");

      // 申請処理後、一覧を取得し直して画面を更新する。
      await reload();

    } catch (e) {

      // 処理に失敗した場合のエラー表示。
      console.log("answer error:", e.message);
      setMessage("処理に失敗しました");
    }
  };


  /*
   * confirmAction
   *
   * フォロー解除やフォロワー削除の確認画面を表示するための関数。
   *
   * kind：
   *   "follow"   → フォロー解除
   *   "follower" → フォロワー削除
   *
   * person：
   *   操作対象となるユーザーの情報。
   *
   * 対象ユーザーの種類・ID・名前をconfirmTargetに保存する。
   */
  const confirmAction = (kind, person) =>
    setConfirmTarget({
      kind,
      id: person.id,
      name: person.name
    });


  /*
   * cancelAction
   *
   * 確認画面で「いいえ」を押したときの処理。
   *
   * confirmTargetをnullに戻すことで、
   * 確認画面を閉じる。
   *
   * データベースの情報は変更しない。
   */
  const cancelAction = () => setConfirmTarget(null);


  /*
   * executeAction
   *
   * 確認画面で「はい」を押したときの処理。
   *
   * confirmTargetに保存されているkindを確認して、
   * フォロー解除かフォロワー削除のどちらかを実行する。
   */
  const executeAction = async () => {

    // 操作対象が存在しない場合は処理を終了する。
    if (!confirmTarget) return;

    try {

      // 操作対象が自分のフォロー一覧にいる場合はフォロー解除。
      if (confirmTarget.kind === "follow")
        await unfollowRemote(confirmTarget.id);

      // それ以外の場合はフォロワーを削除する。
      else
        await removeFollowerRemote(confirmTarget.id);

      // 処理が成功したら一覧を取得し直す。
      await reload();

    } catch (e) {

      // 削除処理に失敗した場合のエラー表示。
      console.log("remove error:", e.message);
      setMessage("処理に失敗しました");
    }

    // 処理終了後、確認画面を閉じる。
    setConfirmTarget(null);
  };


  /*
   * 画面表示部分
   *
   * typeの値によってフォロー一覧とフォロワー一覧を切り替える。
   */
  return (

    // 背景部分をクリックするとモーダルを閉じる。
    <div className="overlay" onClick={onClose}>

      {/* モーダル内部をクリックしたときは閉じないようにする。 */}
      <section
        className="social-modal"
        onClick={(event) => event.stopPropagation()}
      >

        {/* 右上の×ボタン。クリックするとモーダルを閉じる。 */}
        <button className="modal-close" onClick={onClose}>
          ×
        </button>


        {/* モーダルのタイトルと操作ボタン。 */}
        <div className="social-modal-header">

          {/* typeに応じてタイトルを切り替える。 */}
          <h2>{type === "follow" ? "フォロー" : "フォロワー"}</h2>

          {type === "follow" ? (

            // フォロー一覧の場合は友達追加ボタンを表示する。
            <button
              className="friend-add-button"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              友達追加
            </button>

          ) : (

            // フォロワー一覧の場合は申請確認ボタンを表示する。
            // requests.lengthによって未処理の申請数も表示する。
            <button
              className="friend-request-button"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              申請確認 {requests.length}
            </button>
          )}

        </div>


        {/* 友達追加フォーム
            フォロー一覧でsearchOpenがtrueのときだけ表示する。 */}
        {searchOpen && type === "follow" && (

          <form className="friend-search" onSubmit={sendRequest}>

            {/* フォロー申請する相手のユーザーIDを入力する。 */}
            <input
              value={friendId}
              onChange={(event) => setFriendId(event.target.value)}
              placeholder="ユーザーIDを検索（例：MG-1234）"
            />

            {/* 入力されたIDを使って申請を送信する。 */}
            <button>申請</button>

          </form>
        )}


        {/* 申請結果やエラーがある場合にメッセージを表示する。 */}
        {message && <p className="friend-message">{message}</p>}


        {/* フォロワー一覧で申請確認を開いている場合の表示。 */}
        {searchOpen && type === "follower" ? (

          <div className="friend-request-list">

            {/* 申請が1件以上ある場合は、それぞれの申請を表示する。 */}
            {requests.length ? (

              requests.map((item) => (

                // 申請ごとに1つの行を作成する。
                // keyには申請のIDを設定する。
                <div className="friend-request-row" key={item.id}>

                  {/* 申請者の名前の最初の文字をアイコンとして表示する。 */}
                  <span className="small-avatar">{item.name[0]}</span>

                  {/* 申請者の名前を表示する。 */}
                  <b>{item.name}</b>

                  {/* 許可ボタン。クリックすると申請を許可する。 */}
                  <button
                    className="accept"
                    onClick={() => answerRequest(item.id, true)}
                  >
                    許可
                  </button>

                  {/* 拒否ボタン。クリックすると申請を拒否する。 */}
                  <button
                    className="reject"
                    onClick={() => answerRequest(item.id, false)}
                  >
                    拒否
                  </button>

                </div>
              ))

            ) : (

              // 申請が0件の場合に表示する。
              <p className="empty">申請はありません</p>
            )}

          </div>

        ) : (

          // 申請確認画面ではない場合、フォローまたはフォロワー一覧を表示する。
          <div className="social-list">

            {/* typeによって表示する配列を切り替える。
                follow   → follows
                follower → followers */}
            {(type === "follow" ? follows : followers).map((person) => (

              // ユーザー1人につき1つの表示行を作成する。
              <div className="social-item" key={person.id}>

                <div className="social-item-main">

                  {/* ユーザー名の最初の文字をアイコンとして表示する。 */}
                  <span className="small-avatar">{person.name[0]}</span>

                  {/* ユーザー名を表示する。 */}
                  <b>{person.name}</b>


                  {type === "follow" ? (

                    // 自分がフォローしているユーザーの場合。
                    // ボタンを押すとフォロー解除の確認画面を表示する。
                    <button
                      className="following-button"
                      onClick={() => confirmAction("follow", person)}
                    >
                      フォロー中
                    </button>

                  ) : (

                    // 自分のフォロワーの場合。
                    // ボタンを押すとフォロワー削除の確認画面を表示する。
                    <button
                      className="follower-delete-button"
                      onClick={() => confirmAction("follower", person)}
                    >
                      削除
                    </button>
                  )}

                </div>


                {/* confirmTargetのIDと現在のユーザーIDが一致した場合、
                    そのユーザーの行に確認画面を表示する。 */}
                {confirmTarget?.id === person.id && (

                  <div
                    className="social-delete-modal"
                    role="dialog"
                    aria-modal="true"
                  >

                    {/* 削除・解除してよいか確認する。 */}
                    <p>本当に削除しますか？</p>

                    <div>

                      {/* はい：executeActionを実行する。 */}
                      <button className="confirm" onClick={executeAction}>
                        はい
                      </button>

                      {/* いいえ：確認画面を閉じる。 */}
                      <button className="cancel" onClick={cancelAction}>
                        いいえ
                      </button>

                    </div>
                  </div>
                )}

              </div>
            ))}


            {/* フォロー・フォロワーが0人の場合の表示。 */}
            {(type === "follow" ? follows : followers).length === 0 && (
              <p className="empty">まだいません</p>
            )}

          </div>
        )}

      </section>
    </div>
  );
}


/* =========================================================
   ③ マイページ本体
   ========================================================= */

/*
 * MyPage
 *
 * ログイン中のユーザー自身の情報や投稿を表示するコンポーネント。
 *
 * 主な機能：
 * ・プロフィール情報の表示
 * ・ユーザーIDのコピー
 * ・好きな食べ物や味の好みの表示
 * ・フォロー数、フォロワー数、投稿数の表示
 * ・保存した投稿の一覧表示
 * ・自分の投稿の一覧表示
 * ・表示名の変更
 * ・自分の投稿の削除
 *
 *
 * 親コンポーネントから受け取るprops：
 *
 * account：
 *   現在ログインしているユーザーの情報。
 *
 * posts：
 *   アプリ内の投稿データ全体。
 *
 * counts：
 *   フォロー数・フォロワー数などの集計情報。
 *
 * onEditProfile：
 *   プロフィール編集に関する処理。
 *
 * onEditPreferences：
 *   好みの編集画面を開く処理。
 *
 * onUpdateName：
 *   表示名を更新する処理。
 *
 * onOpenSavedPost：
 *   保存した投稿を開く処理。
 *
 * onOpenOwnPost：
 *   自分の投稿を開く処理。
 *
 * onCopyId：
 *   ユーザーIDのコピー完了時などに実行する処理。
 *
 * onSocial：
 *   フォロー・フォロワー一覧を開く処理。
 *
 * onDeletePost：
 *   指定された投稿を削除する処理。
 *
 * onLogout：
 *   ログアウト処理。
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


  /* -------------------------------------------------------
     ③-1 投稿データの抽出
     ------------------------------------------------------- */

  // postsの中からsavedがtrueになっている投稿だけを抽出する。
  // つまり、現在のユーザーが保存した投稿の一覧を作成する。
  const saved = posts.filter((post) => post.saved);


  // postsの中から投稿者ID（userId）が現在のユーザーIDと
  // 一致している投稿だけを抽出する。
  // これによって自分が投稿したものだけを表示できる。
  const ownPosts = posts.filter((post) => post.userId === account.id);


  // accountの中に保存されているプロフィール情報を取り出す。
  // 好きな食べ物や辛さ・甘さ・濃さなどの情報を表示するときに使う。
  const profile = account.profile;


  /* -------------------------------------------------------
     ③-2 マイページ内で使用するstate
     ------------------------------------------------------- */

  // 表示名の編集モーダルを表示するかどうか。
  const [nameEditing, setNameEditing] = useState(false);


  // 表示名の入力欄に入力されている内容を保持する。
  // 最初は現在のアカウント名を設定する。
  const [nameDraft, setNameDraft] = useState(account.name);


  // 投稿削除モードになっているかどうか。
  // true：投稿を選択して削除するモード
  // false：通常の投稿閲覧モード
  const [deleteMode, setDeleteMode] = useState(false);


  // 削除対象として選択された投稿のIDを配列で保持する。
  // 例：["post1", "post3"]
  const [selectedPosts, setSelectedPosts] = useState([]);


  /* -------------------------------------------------------
     ③-3 ユーザーIDのコピー
     ------------------------------------------------------- */

  /*
   * copyId
   *
   * 現在のユーザーのユーザーIDをクリップボードにコピーする。
   *
   * navigator.clipboard.writeText()
   * ブラウザのクリップボード機能を使って文字列をコピーする。
   */
  const copyId = async () => {
    try {

      // account.userIdをクリップボードに書き込む。
      // ?.を使うことでclipboardが利用できない場合にも
      // エラーにならないようにしている。
      await navigator.clipboard?.writeText(account.userId);

    } catch {

      // コピーできない環境でも、後続の通知処理は実行する。
      // ここでは特別な処理を行わない。
    }

    // 親コンポーネントにコピー操作が行われたことを通知する。
    onCopyId();
  };


  /* -------------------------------------------------------
     ③-4 投稿削除モードの切り替え
     ------------------------------------------------------- */

  /*
   * toggleDeleteMode
   *
   * 投稿の削除モードをON・OFFに切り替える。
   *
   * 削除モードを終了するときは、
   * 選択されていた投稿もすべて解除する。
   */
  const toggleDeleteMode = () => {

    // deleteModeのtrueとfalseを反転させる。
    setDeleteMode((prev) => !prev);

    // 現在削除モードの場合、選択した投稿を空に戻す。
    if (deleteMode) setSelectedPosts([]);
  };


  /* -------------------------------------------------------
     ③-5 投稿の選択・選択解除
     ------------------------------------------------------- */

  /*
   * toggleSelectPost
   *
   * 削除モード中に投稿画像をクリックしたときの処理。
   *
   * すでに選択されている投稿なら選択解除する。
   * 選択されていない投稿なら新しく選択する。
   *
   * 投稿IDを使って選択状態を管理する。
   */
  const toggleSelectPost = (postId) => {

    // 現在のselectedPostsをもとに新しい配列を作る。
    setSelectedPosts((prev) =>

      // クリックされた投稿IDがすでに含まれているか確認する。
      prev.includes(postId)

        // 含まれている場合は、その投稿IDを配列から除外する。
        ? prev.filter((id) => id !== postId)

        // 含まれていない場合は、その投稿IDを配列に追加する。
        : [...prev, postId],

    );
  };


  /* -------------------------------------------------------
     ③-6 選択した投稿の削除
     ------------------------------------------------------- */

  /*
   * handleDeleteSelected
   *
   * 削除モードで選択した投稿を削除する。
   *
   * selectedPostsに保存されているIDを1つずつ取り出し、
   * 親コンポーネントから受け取ったonDeletePostを実行する。
   *
   * 削除が終わったら選択状態を解除し、
   * 通常の表示モードに戻す。
   */
  const handleDeleteSelected = () => {

    // 選択されたすべての投稿IDについて削除処理を実行する。
    selectedPosts.forEach((id) => onDeletePost(id));

    // 選択されている投稿IDを空にする。
    setSelectedPosts([]);

    // 削除モードを終了する。
    setDeleteMode(false);
  };


  /* =======================================================
     ④ マイページの画面表示
     ======================================================= */

  return (

    <main className="mypage-screen">


      {/* ---------------------------------------------------
         ④-1 ヘッダー
         --------------------------------------------------- */}

      {/* 共通ヘッダーコンポーネントを呼び出す。
          タイトルに「マイページ」を設定し、
          ログアウト処理を渡す。 */}
      <Header title="マイページ" onLogout={onLogout} />


      {/* ---------------------------------------------------
         ④-2 プロフィール情報
         --------------------------------------------------- */}

      <section className="my-profile">

        {/* ユーザー名の最初の文字をアイコンとして表示する。 */}
        <span className="large-avatar">{account.name[0]}</span>

        <div>

          {/* 現在の表示名を表示する。 */}
          <h2>{account.name}</h2>

          {/* ユーザーIDを表示する。
              クリックするとcopyIdを実行してIDをコピーする。 */}
          <button className="copy-id" onClick={copyId}>
            {account.userId} <span aria-label="コピー">📝</span>
          </button>

        </div>


        {/* プロフィール編集ボタン。
            クリックすると表示名編集モーダルを開く。 */}
        <button className="edit-profile" onClick={() => setNameEditing(true)}>
          プロフィール編集
        </button>

      </section>


      {/* ---------------------------------------------------
         ④-3 好みの情報
         --------------------------------------------------- */}

      {/* profileが存在する場合だけ好みの情報を表示する。 */}
      {profile && (

        <section className="preference-summary">

          <div className="preference-header">

            <h3>私の好み</h3>

            {/* 好みの編集画面を開く。
                実際の編集処理は親コンポーネントに任せる。 */}
            <button onClick={onEditPreferences}>編集</button>

          </div>


          {/* 好きな食べ物を表示する。 */}
          <div className="favorite-foods">

            <b>好きな食べ物</b>

            {/* favoriteFoodsが設定されていればその内容を表示。
                未設定の場合は「未設定」と表示する。 */}
            <span>{profile.favoriteFoods || "未設定"}</span>

          </div>


          {/* 辛さ・甘さ・濃さの好みを表示する。 */}
          <div className="preference-scales">

            {/* 配列の3つの項目をそれぞれ表示する。 */}
            {["辛さ", "甘さ", "濃さ"].map((key) => (

              <p key={key}>

                {/* 項目名を表示する。 */}
                <b>{key}</b>

                <span>

                  {/* 濃さだけは専用の5段階評価を使用する。
                      それ以外の辛さ・甘さは共通の5段階評価を使用する。 */}
                  {key === "濃さ"

                    ? ["薄味", "やや薄", "普通", "やや濃い", "濃い味"][
                        profile[key] ?? 2
                      ]

                    : ["苦手", "やや苦手", "普通", "やや好き", "好き"][
                        profile[key] ?? 2
                      ]
                  }

                </span>

              </p>
            ))}

          </div>
        </section>
      )}


      {/* ---------------------------------------------------
         ④-4 フォロー数・フォロワー数・投稿数
         --------------------------------------------------- */}

      <section className="social-counts">

        {/* フォロー数を表示するボタン。
            クリックするとフォロー一覧を開く。 */}
        <button onClick={() => onSocial("follow")}>

          {/* counts.followingに保存されているフォロー数を表示する。 */}
          <strong>{counts.following}</strong>

          <span>フォロー</span>

        </button>


        {/* フォロワー数を表示するボタン。
            クリックするとフォロワー一覧を開く。 */}
        <button onClick={() => onSocial("follower")}>

          {/* counts.followersに保存されているフォロワー数を表示する。 */}
          <strong>{counts.followers} </strong>

          <span>フォロワー</span>

        </button>


        {/* 自分の投稿数を表示するボタン。
            クリックすると自分の投稿一覧まで画面を移動する。 */}
        <button
          onClick={() =>
            document
              .querySelector(".own-posts")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >

          {/* 自分の投稿数を表示する。 */}
          <strong>{ownPosts.length}</strong>

          <span>投稿数</span>

        </button>

      </section>


      {/* ---------------------------------------------------
         ④-5 保存した投稿一覧
         --------------------------------------------------- */}

      <section className="saved-posts">

        <h3>

          {/* 保存した投稿という見出しと、保存件数を表示する。 */}
          保存した投稿 <span>{saved.length}</span>

        </h3>


        <div>

          {/* 保存した投稿が1件以上ある場合。 */}
          {saved.length ? (

            // saved配列の投稿を1つずつ表示する。
            saved.map((post) => (

              // 投稿画像をボタンとして表示する。
              // クリックすると、その投稿の詳細を開く。
              <button key={post.id} onClick={() => onOpenSavedPost(post)}>

                {/* 投稿に登録されている画像を表示する。 */}
                <img
                  src={post.image}
                  alt={`${post.location}の保存投稿`}
                />

              </button>
            ))

          ) : (

            // 保存した投稿がない場合の表示。
            <p className="empty">保存した投稿はまだありません</p>
          )}

        </div>
      </section>


      {/* ---------------------------------------------------
         ④-6 自分の投稿一覧
         --------------------------------------------------- */}

      <section className="own-posts">

        <div className="own-post-header">

          <h3>

            {/* 削除モードの場合は通常の投稿件数表示をやめる。
                通常モードの場合は投稿数も表示する。 */}
            {deleteMode ? (

              "自分の投稿"

            ) : (

              <>
                自分の投稿 <span>{ownPosts.length}</span>
              </>
            )}

          </h3>


          {/* 削除モードのON・OFFによってボタンを切り替える。 */}
          {deleteMode ? (

            // 削除モードの場合に表示するボタン。
            <div className="own-delete-actions">

              {/* 選択した投稿を削除するボタン。
                  投稿が1件も選択されていない場合は押せない。 */}
              <button
                className="delete-selected-button"
                onClick={handleDeleteSelected}
                disabled={selectedPosts.length === 0}
              >
                削除
              </button>


              {/* キャンセルボタン。
                  削除モードを終了して通常表示に戻す。 */}
              <button
                className="delete-mode-button"
                onClick={toggleDeleteMode}
              >
                キャンセル
              </button>

            </div>

          ) : (

            // 通常モードの場合は削除モードに切り替えるボタンを表示する。
            <button
              className="delete-mode-button"
              onClick={toggleDeleteMode}
            >
              削除
            </button>

          )}

        </div>


        <div>

          {/* 自分の投稿が1件以上ある場合。 */}
          {ownPosts.length ? (

            // ownPostsに含まれる投稿を1つずつ表示する。
            ownPosts.map((post) => (

              // 投稿1件分の表示領域を作成する。
              // 選択中の場合はselectedというCSSクラスを追加する。
              <div
                className={`own-post-item ${selectedPosts.includes(post.id) ? "selected" : ""}`}
                key={post.id}
              >

                {/* 投稿画像をボタンとして表示する。
                    通常モードと削除モードでクリック時の動作を変更する。 */}
                <button
                  className="own-post-image"
                  onClick={() =>

                    // 削除モードの場合は投稿の選択・選択解除を行う。
                    deleteMode
                      ? toggleSelectPost(post.id)

                      // 通常モードの場合は投稿の詳細画面を開く。
                      : onOpenOwnPost(post)
                  }
                >

                  {/* 投稿画像を表示する。 */}
                  <img
                    src={post.image}
                    alt={`${post.location}の投稿`}
                  />


                  {/* 削除モードの場合だけ選択状態を表示する。 */}
                  {deleteMode && (

                    <span className="post-check">

                      {/* 選択されている投稿にはチェックマークを表示する。
                          選択されていない場合は空欄にする。 */}
                      {selectedPosts.includes(post.id) ? "✓" : ""}

                    </span>

                  )}

                </button>

              </div>
            ))

          ) : (

            // 自分の投稿がない場合の表示。
            <p className="empty">投稿はまだありません</p>

          )}

        </div>

      </section>


      {/* ---------------------------------------------------
         ④-7 表示名変更モーダル
         --------------------------------------------------- */}

      {/* nameEditingがtrueの場合だけ編集モーダルを表示する。 */}
      {nameEditing && (

        // 背景部分をクリックすると編集モーダルを閉じる。
        <div className="overlay" onClick={() => setNameEditing(false)}>

          {/* モーダル内部のクリックでは閉じないようにする。 */}
          <section
            className="name-edit-modal"
            onClick={(event) => event.stopPropagation()}
          >

            {/* 右上の×ボタン。クリックするとモーダルを閉じる。 */}
            <button
              className="modal-close"
              onClick={() => setNameEditing(false)}
            >
              ×
            </button>


            {/* モーダルのタイトル。 */}
            <h2>表示名を変更</h2>


            {/* 表示名の入力欄。
                nameDraftに入力内容を保存する。
                入力するたびにstateを更新する。 */}
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="表示名"
            />


            {/* 入力した表示名を保存するボタン。 */}
            <button
              className="primary-button"
              onClick={() => {

                // 空白だけの名前は保存しない。
                if (!nameDraft.trim()) return;

                // 前後の空白を取り除いた名前を親コンポーネントに渡す。
                // 実際の名前の更新処理は親コンポーネント側で行う。
                onUpdateName(nameDraft.trim());

                // 保存後、編集モーダルを閉じる。
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