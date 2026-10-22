/**
 * 「是不是吃饭的地方」过滤用的 Google 类型表，以及判断马来文店名的常见词。
 *
 * 由 ../校验/ 里的脚本从安卓第四版（只读）导出，并已和安卓源码、安卓编译后的真实运行结果逐条核对。
 * 不要手改；安卓源：domain/FoodTypes.kt、domain/MalayHints.kt
 */

/**
 * 算「吃饭的地方」的类型（types 或 primaryType 里有其中一个，或以 _restaurant 结尾）。
 * 安卓 FoodTypes.isEatery(types, primaryType) 的规则：
 * 1. primaryType 在 NON_EATERY_PRIMARY_TYPES 里 → 不是（酒店「饭店」、面包店、杂货店、米行……）；
 * 2. types 或 primaryType 有 EATERY_TYPES 里的、或以 _restaurant 结尾 → 是；
 * 3. 否则：types 里有 "food"、而且没有任何 SHOP_TYPES → 是（只标了 food 的小贩档）；其余不是。
 */
export const EATERY_TYPES = ["restaurant","meal_takeaway","meal_delivery","food_court","noodle_shop","diner","cafeteria","snack_bar","deli","bistro","cafe","coffee_shop","tea_house","hot_dog_stand","kebab_shop","sandwich_shop","gastropub"];

/** primaryType 是这些就一定不是吃饭的地方（就算 types 里有 food / restaurant）。 */
export const NON_EATERY_PRIMARY_TYPES = ["lodging","hotel","motel","resort_hotel","hostel","guest_house","bed_and_breakfast","inn","extended_stay_hotel","budget_japanese_inn","japanese_inn","private_guest_room","bakery","cake_shop","pastry_shop","confectionery","candy_store","chocolate_shop","grocery_store","supermarket","convenience_store","food_store","asian_grocery_store","butcher_shop","health_food_store","wholesaler","warehouse_store","department_store","shopping_mall","store","liquor_store","manufacturer","food_delivery","catering_service"];

/** 没有明确餐饮类型时，有这些 = 卖食材的店，不是吃饭的地方。 */
export const SHOP_TYPES = ["grocery_store","supermarket","convenience_store","food_store","asian_grocery_store","butcher_shop","health_food_store","wholesaler","warehouse_store","store","market","bakery"];

/**
 * 马来文店名的常见词（安卓 MalayHints.looksMalay：店名转小写、按非字母切开，任何一个词在这里就算马来文）。
 * 安卓用它决定机翻用马来文→中文还是英文→中文的模型；网页版如果换了翻译方式，可以照样用来选源语言。
 */
export const MALAY_WORDS = ["restoran","kedai","warung","gerai","medan","selera","makan","makanan","masakan","nasi","mee","mi","bihun","kopi","roti","ayam","ikan","daging","kambing","lembu","udang","sayur","sup","lemak","goreng","bakar","kuah","kandar","mamak","kampung","haji","hj","mak","pak","cik","pondok","sedap","enak","sdn","bhd"];
