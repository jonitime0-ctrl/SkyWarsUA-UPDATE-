
import { Airfield } from './types';

export const AIRFIELDS: Airfield[] = [
  { id: 'primorsko-akhtarsk', name: 'Приморсько-Ахтарськ', location: 'Краснодарський край, РФ', coordinates: '46.06° N, 38.16° E', description: 'Основний хаб запусків Шахедів.', isActive: false },
  { id: 'chauda', name: 'Мис Чауда', location: 'Крим (окупований)', coordinates: '45.00° N, 35.84° E', description: 'Точка запуску по півдню України.', isActive: false },
  { id: 'kursk', name: 'Курськ (Халіно)', location: 'Курська область, РФ', coordinates: '51.75° N, 36.29° E', description: 'Північний напрямок атак.', isActive: false },
  { id: 'orel', name: 'Орел', location: 'Орловська область, РФ', coordinates: '52.96° N, 36.06° E', description: 'Додатковий майданчик запусків.', isActive: false },
  { id: 'yeysk', name: 'Єйськ', location: 'Краснодарський край, РФ', coordinates: '46.68° N, 38.21° E', description: 'Авіабаза та пункт логістики.', isActive: false },
  { id: 'saki', name: 'Саки', location: 'Крим (окупований)', coordinates: '45.09° N, 33.58° E', description: 'Авіація морського базування.', isActive: false },
  { id: 'belbek', name: 'Бельбек', location: 'Крим (окупований)', coordinates: '44.68° N, 33.57° E', description: 'Дислокація винищувачів.', isActive: false },
  { id: 'millerovo', name: 'Міллерово', location: 'Ростовська область, РФ', coordinates: '48.95° N, 40.29° E', description: 'Фронтова авіація.', isActive: false },
  { id: 'engels', name: 'Енгельс-2', location: 'Саратовська область, РФ', coordinates: '51.48° N, 46.21° E', description: 'Стратегічна авіація Ту-95/160.', isActive: false },
  { id: 'shatalovo', name: 'Шаталово', location: 'Смоленська область, РФ', coordinates: '54.33° N, 32.47° E', description: 'Авіабаза розвідувальної та фронтової авіації.', isActive: false },
  { id: 'gvardiyske', name: 'Гвардійське', location: 'Крим (окупований)', coordinates: '45.11° N, 33.97° E', description: 'Авіабаза штурмової авіації.', isActive: false },
  { id: 'bryansk', name: 'Брянськ', location: 'Брянська область, РФ', coordinates: '53.21° N, 34.17° E', description: 'Майданчик запусків БПЛА та логістика.', isActive: false },
  { id: 'dzhankoi', name: 'Джанкой', location: 'Крим (окупований)', coordinates: '45.70° N, 34.42° E', description: 'Аеродром та великий логістичний вузол.', isActive: false },
  { id: 'morozovsk', name: 'Морозовськ', location: 'Ростовська область, РФ', coordinates: '48.31° N, 41.79° E', description: 'База фронтових бомбардувальників Су-34.', isActive: false }
];

export const STRATEGIC_AIRFIELDS = [
  { id: 'olenya', name: 'Оленья', region: 'Мурманська обл.', planes: 'Ту-95МС, Ту-22М3 (основний пункт для запусків)' },
  { id: 'engels2', name: 'Енгельс-2', region: 'Саратовська обл.', planes: 'Ту-160, Ту-95МС (головна база стратегів)' },
  { id: 'shaykovka', name: 'Шайковка', region: 'Калузька обл.', planes: 'Ту-22М3' },
  { id: 'dyagilevo', name: 'Дягілєво', region: 'Рязанська обл.', planes: 'Ту-95МС, Ту-22М3, літаки-заправники Іл-78' },
  { id: 'mozdok', name: 'Моздок', region: 'Північна Осетія', planes: 'Ту-22М3 (часто використовується як аеродром підскоку)' },
  { id: 'bila', name: 'Біла', region: 'Іркутська обл.', planes: 'Ту-22М3 (сибірське угруповання)' },
  { id: 'ukrainka', name: 'Українка', region: 'Амурська обл.', planes: 'Ту-95МС (далекий схід)' },
  { id: 'privolzhskiy', name: 'Приволжський', region: 'Астраханська обл.', planes: 'Використовується для випробувань та тренувань' }
];

export const INITIAL_HISTORICAL_STATS = [
  { id: '1', month: 'Грудень 24', launches: 2840, intercepted: 2345 },
  { id: '2', month: 'Січень 25', launches: 1985, intercepted: 1720 },
  { id: '3', month: 'Лютий 25', launches: 1850, intercepted: 1610 }
];

export const GLOBAL_SUMMARY = {
  totalVerified: 11433,
  averageInterception: 85.2,
  dataSources: ["ПС ЗСУ", "OSINT Бджоли", "DeepState"],
  lastUpdate: new Date().toLocaleDateString('uk-UA')
};