/*
 * =====================================================================
 * LocationMap.jsx ― 地図の表示と、位置情報まわりの関数をまとめたファイル
 * =====================================================================
 *
 * 【役割】
 * 投稿の場所を、地図とピンで表示する。投稿作成画面では、ピンをドラッグしたり
 * 地図をタップしたりして、位置を調整できる。あわせて、座標から住所や市区町村名を
 * 調べる関数も持っている。
 *
 * 【使っているもの】
 *   Leaflet / react-leaflet … 地図を表示するライブラリ
 *   OpenStreetMap           … 地図の画像（タイル）の提供元
 *   Nominatim               … OpenStreetMap の住所検索サービス。
 *                             座標から住所を調べる（逆ジオコーディング）のに使う
 *
 * 【このファイルから出しているもの（他のファイルが使う）】
 *   LocationMap（標準）      … 地図の表示部品
 *   ReverseLocationName      … 場所の名前（店名または住所）を表示する部品
 *   getPostPosition          … 投稿から、地図用の座標を取り出す関数
 *   getCityName              … 座標から、市区町村名を取得する関数
 *
 * 【座標の形】
 *   { latitude: 緯度, longitude: 経度 }
 *   ※ Leaflet 自体は [緯度, 経度] の配列を使うので、必要なところで形を変換している
 *
 * 【ファイルの構成】
 *   1. import
 *   2. 地図の内部部品（RecenterMap / LocationMapEvents / ピンの見た目）
 *   3. getPostPosition   … 投稿から座標を取り出す
 *   4. ReverseLocationName … 場所の名前を表示する
 *   5. getCityName       … 市区町村名を取得する
 *   6. LocationMap       … 地図の表示部品の本体
 */

/* ───────────────────────────────────────────────────────────
 * 1. import
 * ─────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
// 地図の表示に必要な、Leaflet の標準のスタイル
import "leaflet/dist/leaflet.css";

/* ───────────────────────────────────────────────────────────
 * 2. 地図の内部部品
 *    どちらも、画面には何も描かず（null を返す）、地図の動きだけを受け持つ部品。
 *    MapContainer の中に置くことで、地図の操作（useMap など）が使える。
 * ─────────────────────────────────────────────────────────── */

/*
 * 地図の中心を、指定した位置へ移動する部品
 *   position … 移動先 [緯度, 経度]
 *   zoom     … 拡大の度合い（大きいほど拡大。初期値は16 = 街並みが見えるくらい）
 * 位置が変わったとき（写真を選び直したときなど）に、地図もそこへ動かす。
 */
function RecenterMap({ position, zoom = 16 }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, zoom);
  }, [map, position, zoom]);
  return null;
}

/*
 * 地図のクリック（タップ）を受け取る部品
 *   onSelect … クリックされた位置を { latitude, longitude } の形で渡して呼ぶ
 * 投稿作成画面で、地図をタップしてピンの位置を決めるときに使う。
 */
function LocationMapEvents({ onSelect }) {
  useMapEvents({
    click(event) {
      if (onSelect) {
        onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      }
    },
  });
  return null;
}

/*
 * ピンの見た目。絵文字の📍を、地図に置けるアイコンにしている
 *   className … 見た目のスタイル（Common.css の .moglog-location-pin）
 *   iconSize  … アイコンの大きさ 32×32
 *   iconAnchor… アイコンのどこを地図上の座標に合わせるか。
 *               [16, 30] は「横の中央・下の先端」で、ピンの先が指す位置になる
 */
const locationPinIcon = L.divIcon({
  className: "moglog-location-pin",
  html: "📍",
  iconSize: [32, 32],
  iconAnchor: [16, 30],
});

/* ───────────────────────────────────────────────────────────
 * 3. getPostPosition ― 投稿から、地図に使う座標を取り出す
 * ─────────────────────────────────────────────────────────── */

/*
 * 投稿から座標を取り出して、{ latitude, longitude } で返す。取り出せなければ null。
 *
 *   ① post.gps があれば、その緯度・経度をそのまま使う（今の投稿は、こちら）
 *   ② なければ、古い形式の post.pin（地図上の位置を横・縦の％で持つもの）から、
 *      東京駅あたりを基準にした座標へ変換する（サンプル投稿の頃の名残）
 *   ③ どちらもなければ null（位置情報なし）
 */
export function getPostPosition(post) {
  if (post?.gps?.latitude != null && post.gps.longitude != null) {
    return { latitude: post.gps.latitude, longitude: post.gps.longitude };
  }
  if (post?.pin?.x != null && post.pin?.y != null) {
    return {
      latitude: 35.681236 + (50 - post.pin.y) * 0.002,
      longitude: 139.767125 + (post.pin.x - 50) * 0.003,
    };
  }
  return null;
}

/* ───────────────────────────────────────────────────────────
 * 4. ReverseLocationName ― 場所の名前を表示する部品
 * ─────────────────────────────────────────────────────────── */

/*
 * 場所の名前を文字として表示する部品
 *   post     … 対象の投稿（店名と座標を持つ）
 *   position … 座標を直接指定したいとき（投稿作成中の、ピンの現在位置など）
 *   fallback … 名前が分からないときに出す文字
 *
 * 表示する内容は、次の優先順位で決まる。
 *   ① 店名が入力されていれば、店名をそのまま表示する
 *   ② 店名がなければ、座標から住所を調べて表示する
 *       「都道府県 市区町村 地区 道路」の形（例: 東京都 渋谷区 神宮前 表参道）
 *   ③ 座標もなければ fallback の文字を表示する
 *
 * 住所の取得は Nominatim への問い合わせ（通信）で行う。
 * 途中で画面が閉じたり位置が変わったりしたときは、通信を中止する（AbortController）。
 */
export function ReverseLocationName({ post, position, fallback = "位置未設定" }) {
  const [address, setAddress] = useState("");

  useEffect(() => {
    // ① 店名があるときは、住所を調べず、店名を使う
    if (post?.location?.trim() && post.location !== "場所未設定") {
      setAddress(post.location);
      return;
    }

    // 調べる座標: 直接指定された position を優先し、なければ投稿から取り出す
    const current = position || getPostPosition(post);
    if (!current) {
      setAddress("");
      return;
    }

    // ② 座標から住所を調べる
    //    zoom=18 は、道路名までの細かい単位。accept-language=ja で日本語の結果にする
    const controller = new AbortController();
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${current.latitude}&lon=${current.longitude}&zoom=18&accept-language=ja`,
      {
        signal: controller.signal,
      },
    )
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        // 返ってきた住所の部品から、都道府県・市区町村・地区・道路を取り出す
        // 地域によって項目名が違うので、いくつかの候補から最初にあるものを使う
        const value = data.address || {};
        const prefecture = value.state || value.province || "";
        const city =
          value.city || value.town || value.village || value.municipality || "";
        const district =
          value.city_district || value.suburb || value.neighbourhood || "";
        const road = value.road || "";
        // 空の項目を除いて、スペースでつなぐ
        setAddress(
          [prefecture, city, district, road].filter(Boolean).join(" "),
        );
      })
      .catch(() => setAddress("位置情報を取得できませんでした"));

    // 後片付け: 画面が閉じたり、座標が変わったりしたとき、途中の通信を中止する
    return () => controller.abort();
  }, [post?.location, position?.latitude, position?.longitude]);

  // 表示する文字を決める（優先順位は上の説明の ①→②→③）
  if (post?.location?.trim() && post.location !== "場所未設定")
    return post.location;
  return address || fallback;
}

/* ───────────────────────────────────────────────────────────
 * 5. getCityName ― 座標から市区町村名を取得する
 * ─────────────────────────────────────────────────────────── */

/*
 * 座標から、市区町村名（例: 渋谷区）を取得して返す。分からなければ空文字を返す。
 * 使う場所:
 *   ・投稿作成画面で、写真のGPSやピンの位置から、市区町村を自動入力する
 *   ・ホーム画面で、市区町村が未入力の投稿の「市」の絞り込みに使う
 *
 * ReverseLocationName より大まかな単位（zoom=10 = 市区町村）で調べる。
 * 通信に失敗しても、エラーにはせず空文字を返す（画面が止まらないようにするため）。
 */
export async function getCityName(position) {
  // 座標がないとき（または 0 のとき）は、調べずに空文字を返す
  if (!position?.latitude || !position?.longitude) return "";
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.latitude}&lon=${position.longitude}&zoom=10&accept-language=ja`,
    );
    if (!response.ok) return "";
    const data = await response.json();
    const value = data.address || {};
    // 地域によって項目名が違うので、いくつかの候補から最初にあるものを使う
    return (
      value.city || value.town || value.village || value.municipality || ""
    );
  } catch {
    return "";
  }
}

/* ───────────────────────────────────────────────────────────
 * 6. LocationMap ― 地図の表示部品の本体
 * ─────────────────────────────────────────────────────────── */

/*
 * 地図を表示する部品（このファイルの標準の出力）
 *   post             … 表示する投稿。座標は getPostPosition で取り出す
 *   position         … 座標を直接指定するとき（投稿作成画面で、ピンの現在位置を渡す）
 *   editable         … true なら、ピンをドラッグしたり地図をタップしたりして位置を変えられる
 *   onPositionChange … 位置が変わったとき、新しい座標を渡して呼ぶ（editable のとき）
 *   className        … 地図の大きさ違いのクラス名（inline-location-map など。Common.css）
 *
 * 位置情報がない投稿のときは、ピンを出さず、東京駅あたりを中心に広めに表示する。
 */
export default function LocationMap({
  post,
  position,
  editable = false,
  onPositionChange,
  className = "",
}) {
  // 表示する座標: 直接指定された position を優先し、なければ投稿から取り出す
  const currentPosition = position || getPostPosition(post);
  // 地図の中心 [緯度, 経度]。位置がないときは、東京駅あたり
  const center = currentPosition
    ? [currentPosition.latitude, currentPosition.longitude]
    : [35.681236, 139.767125];

  // 位置が選ばれたとき、editable のときだけ、親へ新しい座標を伝える
  const selectPosition = (nextPosition) => {
    if (editable && onPositionChange) onPositionChange(nextPosition);
  };

  return (
    <div className={`location-leaflet-map ${className}`}>
      <MapContainer
        center={center}
        // 位置があるときは街並みが見える拡大（16）、ないときは都市全体が見える拡大（11）
        zoom={currentPosition ? 16 : 11}
        scrollWheelZoom
      >
        {/* 地図の画像。OpenStreetMap から配信されるものを使う（出典の表示は利用条件） */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* ピン。editable のときは、ドラッグでき、離した位置を親へ伝える */}
        {currentPosition && (
          <Marker
            position={[currentPosition.latitude, currentPosition.longitude]}
            icon={locationPinIcon}
            draggable={editable}
            eventHandlers={
              editable
                ? {
                    dragend: (event) => {
                      const next = event.target.getLatLng();
                      selectPosition({
                        latitude: next.lat,
                        longitude: next.lng,
                      });
                    },
                  }
                : undefined
            }
          />
        )}
        {/* 位置が変わったら、地図の中心もそこへ動かす */}
        {currentPosition && <RecenterMap position={center} zoom={16} />}
        {/* editable のときだけ、地図のタップを受け付ける */}
        {editable && <LocationMapEvents onSelect={selectPosition} />}
      </MapContainer>
    </div>
  );
}