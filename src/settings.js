// Which fields to include in frontmatter. Look in /src/frontmatter to see available fields.
// Order is preserved. If a field has an empty value, it will not be included. You can rename a
// field by providing an alias after a ':'. For example, 'date:created' will include 'date' in
// frontmatter, but renamed to 'created'.
exports.frontmatter_fields = ["title", "date", "cover", "categories", "destino", "tags", "authors"];

// Time in ms to wait between requesting image files. Increase this if you see timeouts or
// server errors.
exports.image_file_request_delay = 500;

// Time in ms to wait between saving Markdown files. Increase this if your file system becomes
// overloaded.
exports.markdown_file_write_delay = 25;

// Enable this to include time with post dates. For example, "2020-12-25" would become
// "2020-12-25T11:20:35.000Z".
exports.include_time_with_date = false;

// Override post date formatting with a custom formatting string (for example: 'yyyy LLL dd').
// Tokens are documented here: https://moment.github.io/luxon/#/parsing?id=table-of-tokens. If
// set, this takes precedence over include_time_with_date.
exports.custom_date_formatting = "";

// Categories to be excluded from post frontmatter. This does not filter out posts themselves,
// just the categories listed in their frontmatter.
exports.filter_categories = ["uncategorized"];

const categoryMap = {
  "bienestar-belleza": "bienestar",
  "consejos-practicos": "inspiración",
  "de-un-vistazo": "inspiración",
  "experiencias-viajeras": "inspiración",
  "exposiciones": "cultura",
  "festivales": "ocio",
  "historias-en-femenino": "historias",
  "hoteles": "hoteles",
  "libros-de-viajes": "cultura",
  "mejores-restaurantes-gastronomia": "gourmet",
  "mi-peor-viaje": "historias",
  "mujeres-etheria": "mujeres-top",
  "mujeres-que-inspiran": "mujeres-top",
  "organiza-tu-viaje": null,
  "parques-ocio": "ocio",
  "planes-cultura-ocio": "ocio",
  "planes-originales-para-mujeres": null,
  "proyectos-con-alma": "proyectos",
  "que-llevar-en-la-maleta": "qué-llevar-en-la-maleta",
  "regalos-compras-viajeras": "compras",
  "salud-bienestar-nutricion": "bienestar",
  "sorteos-y-concursos": "sorteos",
  "viajar-sola": "viajar-sola",
  "viaje-en-familia": "viajar-en-familia",
  "viajes-48-horas": "viajar-con-amigas",
  "viajes-cine": "inspiración",
  "viajes-con-amigas": "viajar-con-amigas",
  "viajes-ecoturismo": "viajar-en-familia",
  "viajes-gastronomicos": "viajar-con-amigas",
  "viajes-para-mujeres": null,
  "viajes-romanticos": "viajar-en-pareja",
  "viajes-urbanos": "viajar-sola",
  "visitas-guiadas": null
};


exports.new_categories = [
  { slug: "bienestar", description: "Un espacio dedicado al bienestar, el autocuidado y la salud mental para disfrutar de cada viaje.", title: "Bienestar" },
  { slug: "compras", description: "Descubre las mejores compras y artículos esenciales para tu aventura de viaje.", title: "Compras" },
  { slug: "cultura", description: "Sumérgete en las tradiciones, arte y cultura local de los destinos más fascinantes.", title: "Cultura" },
  { slug: "gourmet", description: "Una sección para las viajeras foodie: disfruta de lo mejor de la gastronomía en cada rincón del mundo.", title: "Gourmet" },
  { slug: "historias", description: "Historias inspiradoras de mujeres viajeras que han recorrido el mundo y nos cuentan sus experiencias.", title: "Historias" },
  { slug: "hoteles", description: "Recomendaciones de los mejores hoteles y alojamientos para unas vacaciones cómodas y seguras.", title: "Hoteles" },
  { slug: "inspiracion", description: "Encuentra la inspiración para tu próxima aventura con consejos, citas y experiencias únicas.", title: "Inspiración" },
  { slug: "mujeres-top", description: "Conoce a las mujeres más influyentes y valientes que están dejando huella en el mundo de los viajes.", title: "Mujeres Top" },
  { slug: "ocio", description: "Actividades de ocio, entretenimiento y diversión para disfrutar mientras exploras nuevos destinos.", title: "Ocio" },
  { slug: "proyectos", description: "Iniciativas y proyectos que impulsan el empoderamiento de las mujeres a través del viaje.", title: "Proyectos" },
  { slug: "que-llevar-en-la-maleta", description: "Consejos prácticos sobre qué llevar en tu maleta para cada tipo de viaje, desde aventuras solitarias hasta escapadas románticas.", title: "Qué llevar en la maleta" },
  { slug: "sorteos", description: "Participa en nuestros sorteos y gana increíbles premios para tu próximo viaje.", title: "Sorteos" },
  { slug: "viajar-con-amigas", description: "Consejos y guías para disfrutar de viajes inolvidables con tus amigas en destinos maravillosos.", title: "Viajar con amigas" },
  { slug: "viajar-en-familia", description: "Encuentra ideas y consejos para viajes familiares llenos de diversión, aprendizaje y momentos especiales.", title: "Viajar en familia" },
  { slug: "viajar-en-pareja", description: "Descubre los destinos más románticos y actividades para compartir con tu pareja en cada viaje.", title: "Viajar en pareja" },
  { slug: "viajar-sola", description: "Explora el mundo por tu cuenta: consejos, seguridad y empoderamiento para las mujeres viajeras solas.", title: "Viajar sola" }
];


exports.chooseMainTravelCategory = function(categories) {

  return applyJustOneTravelCategory(categories, [
    'viajes-romanticos',
    'viajar-sola',    
    'viajes-con-amigas',
    'viaje-en-familia'
  ]);
}

function applyJustOneTravelCategory(categories, preorder) {

  for (const mainCategory of preorder) {
    if(categories.includes(mainCategory)) {
      // if category found, remove all other travel categories
      let other =  categories.filter(category => !category.match(/^(viaje|viajar|viajes)/));
      // console.log(mainCategory, categories, other);
      return [mainCategory, ... other ]
    }
  }

  let travel = categories.filter(category => category.match(/^(viaje|viajar|viajes)/));
  let other =  categories.filter(category => !travel.includes(category));

  return [...travel, ...other];
}

exports.translateCategory = function (category) {
  return categoryMap[category];
};

const authorMap = require("./authors_db.json").reduce(
  (acc, item) => ({ ...acc, [item.oldRefKey]: item }),
  {}
);

exports.translateAuthor = function (oldRefKey) {
  return authorMap[oldRefKey]?.term || oldRefKey;
};

exports.getAuthor = function (oldRefKey) {
	return authorMap[oldRefKey];
}