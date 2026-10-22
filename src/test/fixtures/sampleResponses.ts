/**
 * 测试用：一份真实格式的 Places API (New) 文字搜索回复（吉隆坡 "nasi"，数值是编的），给网页版的模拟（mock）测试用。
 *
 * 由 ../校验/ 里的脚本从安卓第四版（只读）导出，并已和安卓源码、安卓编译后的真实运行结果逐条核对。
 * 不要手改；安卓源：app/src/test/java/com/meishijiandaobu/app/data/SampleResponses.kt
 */

/**
 * 6 家：马来文名的 nasi kandar（营业中、24 小时、2 张照片、价钱 RM10–20）、中文名的咖啡店（休息中，只有 openNow）、
 * 英文名的美食中心（价钱只有起价「RM15 以上」，没有营业时间）、米行（不是吃饭的地方）、酒店（不是吃饭的地方）、
 * 没有评分而且暂停营业的档口。还故意带了几个没要的字段，证明不认识的字段会被忽略。
 */
export const TEXT_SEARCH_KL = String.raw`{
  "places": [
    {
      "id": "ChIJnasiKandarPelita001",
      "types": ["indian_restaurant", "halal_restaurant", "restaurant", "food", "point_of_interest", "establishment"],
      "formattedAddress": "149, Jalan Ampang, Kuala Lumpur City Centre, 50450 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur",
      "shortFormattedAddress": "149, Jalan Ampang, Kuala Lumpur",
      "location": { "latitude": 3.1597, "longitude": 101.7135 },
      "rating": 4.1,
      "userRatingCount": 12873,
      "priceLevel": "PRICE_LEVEL_INEXPENSIVE",
      "priceRange": {
        "startPrice": { "currencyCode": "MYR", "units": "10" },
        "endPrice": { "currencyCode": "MYR", "units": "20" }
      },
      "googleMapsUri": "https://maps.google.com/?cid=1111111111111111111",
      "businessStatus": "OPERATIONAL",
      "displayName": { "text": "Restoran Nasi Kandar Pelita", "languageCode": "ms" },
      "primaryType": "indian_restaurant",
      "primaryTypeDisplayName": { "text": "印度餐厅", "languageCode": "zh-CN" },
      "currentOpeningHours": {
        "openNow": true,
        "periods": [ { "open": { "day": 0, "hour": 0, "minute": 0 } } ],
        "weekdayDescriptions": ["星期一: 24 小时营业"],
        "nextCloseTime": "2026-10-04T16:00:00Z"
      },
      "photos": [
        {
          "name": "places/ChIJnasiKandarPelita001/photos/AUc7tXPhoto001",
          "widthPx": 4032,
          "heightPx": 3024,
          "authorAttributions": [
            { "displayName": "Ahmad Faizal", "uri": "https://maps.google.com/maps/contrib/1", "photoUri": "https://lh3.googleusercontent.com/a-/x=s100" }
          ],
          "flagContentUri": "https://www.google.com/local/imagery/report/?cb_client=maps_api_places",
          "googleMapsUri": "https://www.google.com/maps/place//data=!3m4"
        },
        { "name": "places/ChIJnasiKandarPelita001/photos/AUc7tXPhoto002", "widthPx": 800, "heightPx": 600, "authorAttributions": [] }
      ],
      "utcOffsetMinutes": 480,
      "plusCode": { "globalCode": "6PM3QPQ7+V9" }
    },
    {
      "id": "ChIJkopitiamLaiFoong002",
      "types": ["coffee_shop", "cafe", "food", "point_of_interest", "establishment"],
      "shortFormattedAddress": "138, Jalan Tun H S Lee, Kuala Lumpur",
      "location": { "latitude": 3.1452, "longitude": 101.6975 },
      "rating": 4.3,
      "userRatingCount": 2456,
      "priceRange": { "startPrice": { "currencyCode": "MYR", "units": "1" }, "endPrice": { "currencyCode": "MYR", "units": "10" } },
      "businessStatus": "OPERATIONAL",
      "displayName": { "text": "联丰茶室", "languageCode": "zh" },
      "primaryType": "coffee_shop",
      "primaryTypeDisplayName": { "text": "咖啡店", "languageCode": "zh-CN" },
      "currentOpeningHours": { "openNow": false },
      "googleMapsUri": "https://maps.google.com/?cid=2222222222222222222"
    },
    {
      "id": "ChIJfoodCourt003",
      "types": ["food_court", "food", "point_of_interest", "establishment"],
      "formattedAddress": "Lot 10 Hutong, 50 Jalan Sultan Ismail, Bukit Bintang, 50250 Kuala Lumpur",
      "location": { "latitude": 3.1466, "longitude": 101.7123 },
      "rating": 4.0,
      "userRatingCount": 5230,
      "priceRange": { "startPrice": { "currencyCode": "MYR", "units": "15" } },
      "businessStatus": "OPERATIONAL",
      "displayName": { "text": "Lot 10 Hutong Food Court", "languageCode": "en" },
      "primaryType": "food_court",
      "primaryTypeDisplayName": { "text": "Food Court", "languageCode": "en" }
    },
    {
      "id": "ChIJriceWholesaler004",
      "types": ["wholesaler", "store", "point_of_interest", "establishment"],
      "shortFormattedAddress": "Jalan Kuching, Kuala Lumpur",
      "location": { "latitude": 3.1500, "longitude": 101.6900 },
      "rating": 4.6,
      "userRatingCount": 37,
      "businessStatus": "OPERATIONAL",
      "displayName": { "text": "Syarikat Beras Wholesale", "languageCode": "ms" },
      "primaryType": "wholesaler"
    },
    {
      "id": "ChIJhotel005",
      "types": ["hotel", "lodging", "restaurant", "food", "point_of_interest", "establishment"],
      "shortFormattedAddress": "Jalan Bukit Bintang, Kuala Lumpur",
      "location": { "latitude": 3.1470, "longitude": 101.7100 },
      "rating": 4.4,
      "userRatingCount": 3100,
      "businessStatus": "OPERATIONAL",
      "displayName": { "text": "金都大饭店", "languageCode": "zh-CN" },
      "primaryType": "hotel"
    },
    {
      "id": "ChIJnoRating006",
      "types": ["restaurant", "food"],
      "location": { "latitude": 3.1460, "longitude": 101.7000 },
      "displayName": { "text": "Warung Mak Teh" },
      "businessStatus": "CLOSED_TEMPORARILY"
    }
  ],
  "searchUri": "https://www.google.com/maps/search/nasi"
}`;
