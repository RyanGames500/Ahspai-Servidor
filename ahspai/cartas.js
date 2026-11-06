// AHSPAI - Las 62 cartas reales (leídas de las imágenes; revisar con Ryan)
// La clave es el código impreso en la carta. "archivo" = nombre de la imagen en el juego.
module.exports = {
 "AHA-28": {
  "nombre": "Aclla de Hampatu",
  "expansion": "AHAHO",
  "tipo": "unidad",
  "archivo": "aclla_de_hampatu",
  "especie": "humano",
  "clase": "especial",
  "movil": true,
  "defensa": 4,
  "ataque": 3,
  "naturaleza": "femenino",
  "elemento": [
   "agua"
  ],
  "alineamiento": "espiritista",
  "pv": 4,
  "brio": "Viva",
  "genera": {
   "creencia": 3
  },
  "acciones": [
   "honor",
   "reaccion"
  ],
  "honor": "Hampatu",
  "efecto": "Honor (Hampatu) +1. (Al bajar): Busca en tu mazo Principal una carta con \"Hampatu\" en su nombre y bájala o actívala sin pagar coste. (En batalla): Aumenta 1 de ataque y defensa a Unidades Animales Elemento AGUA Común.",
  "alineamientoTexto": "Espiritista",
  "sobrenatural": false
 },
 "AHA-25": {
  "nombre": "Ama Sua, Ama Llulla, Ama Quella",
  "expansion": "AHAHO",
  "tipo": "suceso",
  "archivo": "ama_llulla_ama_quella_ama_sua",
  "elemento": [
   "luz"
  ],
  "alineamiento": "bendito",
  "costo": {
   "alimento": 1,
   "capital": 1,
   "creencia": 1
  },
  "acciones": [
   "imparable",
   "reaccion"
  ],
  "efecto": "(Al activar): Selecciona un efecto: 1. Baja una unidad humana común/especial sin pagar costo. 2. Anula el efecto de una carta suceso/simple. 3. Ambos jugadores revelan sus cartas entre sí.",
  "alineamientoTexto": "Bendito"
 },
 "AHA-11": {
  "nombre": "Amauta el Machacador de Cráneos - Inca",
  "expansion": "AHAHO",
  "tipo": "unidad",
  "archivo": "amauta_el_machacdor_de_craneos",
  "especie": "humano",
  "clase": "especial",
  "movil": true,
  "defensa": 6,
  "ataque": 6,
  "naturaleza": "masculino",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "belico",
  "pv": 4,
  "brio": "Vivo",
  "costo": {
   "alimento": 2,
   "capital": 2
  },
  "acciones": [],
  "efecto": "",
  "alineamientoTexto": "Bélico",
  "sobrenatural": false
 },
 "AHA-15": {
  "nombre": "Ayni",
  "expansion": "AHAHO",
  "tipo": "estructura",
  "archivo": "ayni",
  "movil": true,
  "defensa": 3,
  "ataque": 1,
  "elemento": [
   "tierra"
  ],
  "alineamiento": "simple",
  "pv": 2,
  "brio": "Activo",
  "genera": {
   "alimento": 6
  },
  "acciones": [
   "acuartelar"
  ],
  "acuartelar": "2 Unid. humana común",
  "efecto": "(Al bajar): Toma una carta del reciclaje y agrégala a tu mano.",
  "alineamientoTexto": "Simple"
 },
 "AHA-27": {
  "nombre": "Coca",
  "expansion": "AHAHO",
  "tipo": "suceso",
  "archivo": "coca",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "simple",
  "costo": {
   "alimento": 2
  },
  "acciones": [
   "reaccion",
   "emboscar"
  ],
  "efecto": "(Al activar): Aumenta 3 de defensa o 2 de ataque a todas las Unidades Humanas en TU tablero durante este turno.",
  "alineamientoTexto": "Simple"
 },
 "AHA-04": {
  "nombre": "Cóndor Andino",
  "expansion": "AHAHO",
  "tipo": "unidad",
  "archivo": "condor_andino",
  "especie": "animal",
  "clase": "especial",
  "movil": true,
  "defensa": 4,
  "ataque": 2,
  "naturaleza": null,
  "elemento": [
   "viento"
  ],
  "alineamiento": "alimana",
  "pv": 2,
  "brio": "Vivo",
  "costo": {
   "alimento": 2
  },
  "acciones": [
   "emboscar"
  ],
  "efecto": "(Al bajar): Puedes enviar al mazo correspondiente, cambiar de posición o tomar el control de 1 Unidad Animal Común o Especial con defensa 3 o menor.",
  "alineamientoTexto": "Alimaña",
  "sobrenatural": false
 },
 "AHA-22": {
  "nombre": "Guallcanga del Supay - Huaca Maldita",
  "expansion": "AHAHO",
  "tipo": "objeto",
  "archivo": "escucdo_del_supay",
  "elemento": [
   "oscuridad"
  ],
  "alineamiento": "armamento",
  "costo": {
   "creencia": 1,
   "capital": 1
  },
  "acciones": [
   "emboscar"
  ],
  "efecto": "(En tablero): Equipa esta carta a cualquier Unidad Humana, aumenta 5 su defensa permanentemente y cambia automáticamente a posición defensiva; esta Unidad ya no podrá cambiar a posición de ataque.",
  "alineamientoTexto": "Armamento"
 },
 "AHA-34": {
  "nombre": "Furufurhue",
  "expansion": "AHAHO",
  "tipo": "unidad",
  "archivo": "furufuruhue",
  "especie": "sobrenatural",
  "clase": "especial",
  "movil": true,
  "defensa": 4,
  "ataque": 4,
  "naturaleza": null,
  "elemento": [
   "viento"
  ],
  "alineamiento": "espectro",
  "pv": 3,
  "brio": "Vivo",
  "costo": {
   "creencia": 4
  },
  "acciones": [
   "emboscar"
  ],
  "efecto": "(En tablero): Si esta carta está en defensa no puede ser afectada por ningún efecto. (En batalla): Puedes pagar X de Creencia para aumentar X de defensa a esta carta durante este turno.",
  "leyenda": "Vendaval Imparable del Sur",
  "alineamientoTexto": "Espectro",
  "sobrenatural": true
 },
 "AHA-30": {
  "nombre": "Golpe Zonda",
  "expansion": "AHAHO",
  "tipo": "suceso",
  "archivo": "golpe_zonda",
  "elemento": [
   "viento"
  ],
  "alineamiento": "maldito",
  "costo": {
   "creencia": 2
  },
  "acciones": [],
  "efecto": "(Al activar): Selecciona y destruye una carta de estructura propia y del oponente. Luego cada jugador envía una carta humana de sus propios tableros a su respectivo mazo. Por último, cada jugador mezcla su mazo y roba una carta.",
  "alineamientoTexto": "Maldito"
 },
 "AHA-23": {
  "nombre": "Hacha Arrojadiza",
  "expansion": "AHAHO",
  "tipo": "objeto",
  "archivo": "hacha_arrojadiza",
  "elemento": [
   "viento"
  ],
  "alineamiento": "armamento",
  "costo": {
   "capital": 1
  },
  "acciones": [
   "emboscar",
   "reaccion"
  ],
  "efecto": "(En tablero): Equipa esta carta a una UNIDAD BÉLICA, aumenta 2 de ataque hasta que realice un ataque. Luego del ataque descarta esta carta.",
  "alineamientoTexto": "Armamento"
 },
 "AHA-31": {
  "nombre": "Huevo de Oro - del Reinicio",
  "expansion": "AHAHO",
  "tipo": "suceso",
  "archivo": "huevo_oro",
  "elemento": [
   "luz"
  ],
  "alineamiento": "bendito",
  "costo": {
   "creencia": 5
  },
  "acciones": [
   "imparable",
   "reaccion"
  ],
  "efecto": "(Al activar): Busca en tu mazo o mausoleo una carta humana, imperial masculina y agrégala a tu mano.",
  "leyenda": "Fruto del Arrepentimiento de Vichama",
  "alineamientoTexto": "Bendito"
 },
 "AHA-32": {
  "nombre": "Hurkaway - Señora del Abismo",
  "expansion": "AHAHO",
  "tipo": "suceso",
  "archivo": "hurkaway_senora",
  "elemento": [
   "oscuridad"
  ],
  "alineamiento": "maldito",
  "costo": {
   "creencia": 3
  },
  "acciones": [],
  "efecto": "(Al activar): Selecciona hasta 3 cartas de tu Mausoleo y hasta 3 cartas del Mausoleo oponente y envíalas al Abismo. Luego obtienes hasta 3 cartas del tope del mazo principal y/o del mazo de recursos y agrégalas a tu mano. Luego tu oponente debe generar 3 recursos a elección.",
  "alineamientoTexto": "Maldito"
 },
 "AHA-05": {
  "nombre": "Kalla de los Cerros - Inca",
  "expansion": "AHAHO",
  "tipo": "unidad",
  "archivo": "kalla_de_los_cerros_inca",
  "especie": "humano",
  "clase": "comun",
  "movil": true,
  "defensa": 3,
  "ataque": 2,
  "naturaleza": "masculino",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "belico",
  "pv": 1,
  "brio": "Vivo",
  "costo": {
   "alimento": 1,
   "capital": 1
  },
  "acciones": [
   "agrupar"
  ],
  "efecto": "(En tablero): Una vez por turno, puedes pagar 1 Capital para infligir 1 de Contusión a una carta en el tablero.",
  "alineamientoTexto": "Bélico",
  "sobrenatural": false
 },
 "AHA-16": {
  "nombre": "Minka",
  "expansion": "AHAHO",
  "tipo": "estructura",
  "archivo": "minka",
  "movil": false,
  "defensa": 3,
  "ataque": 0,
  "elemento": [
   "tierra"
  ],
  "alineamiento": "simple",
  "pv": 2,
  "brio": "Activo",
  "genera": {
   "capital": 3
  },
  "acciones": [
   "acuartelar"
  ],
  "acuartelar": "2 Unid. humana común",
  "efecto": "(Al bajar): Puedes buscar una estructura del Mausoleo y enviarla al mazo de recursos.",
  "alineamientoTexto": "Simple"
 },
 "AHA-17": {
  "nombre": "Mita",
  "expansion": "AHAHO",
  "tipo": "estructura",
  "archivo": "mita",
  "movil": false,
  "defensa": 4,
  "ataque": 2,
  "elemento": [
   "tierra"
  ],
  "alineamiento": "simple",
  "pv": 3,
  "brio": "Activo",
  "genera": {
   "capital": 5
  },
  "acciones": [
   "acuartelar"
  ],
  "acuartelar": "2 Unid. humana",
  "efecto": "(Al bajar): Puedes buscar hasta 2 cartas humanas común de tu mazo principal y agregarlas a tu mano.",
  "leyenda": "Trabajando en la Mita desde que comienza el día, hasta que se pone el Sol",
  "alineamientoTexto": "Simple"
 },
 "AHA-13": {
  "nombre": "Paisana",
  "expansion": "AHAHO",
  "tipo": "unidad",
  "archivo": "paisana",
  "especie": "humano",
  "clase": "comun",
  "movil": true,
  "defensa": 1,
  "ataque": 1,
  "naturaleza": "femenino",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "peon",
  "pv": 0,
  "brio": "Vivo",
  "genera": {
   "alimento": 2,
   "creencia": 1
  },
  "acciones": [
   "agrupar"
  ],
  "efecto": "",
  "alineamientoTexto": "Peón",
  "sobrenatural": false
 },
 "AHA-37": {
  "nombre": "Pillan el Atormentador",
  "expansion": "AHAHO",
  "tipo": "unidad",
  "archivo": "pillan",
  "especie": "sobrenatural",
  "clase": "comun",
  "movil": true,
  "defensa": 3,
  "ataque": 3,
  "naturaleza": null,
  "elemento": [
   "luz"
  ],
  "alineamiento": "espectro",
  "pv": 2,
  "brio": "No muerto",
  "costo": {
   "creencia": 2
  },
  "acciones": [
   "demoledor",
   "agrupar"
  ],
  "efecto": "(Al bajar): Selecciona 1 Unidad Humana o Animal; esta no podrá atacar en el siguiente turno.",
  "leyenda": "El destello de las Alturas",
  "alineamientoTexto": "Espectro",
  "sobrenatural": true
 },
 "AHA-18": {
  "nombre": "Pirca",
  "expansion": "AHAHO",
  "tipo": "estructura",
  "archivo": "pirca",
  "movil": false,
  "defensa": 6,
  "ataque": 3,
  "elemento": [
   "tierra"
  ],
  "alineamiento": "belico",
  "pv": 5,
  "brio": "Activo",
  "genera": {
   "capital": 3
  },
  "acciones": [
   "acuartelar",
   "emboscar"
  ],
  "acuartelar": "3 Unid. Humanas",
  "efecto": "(Al bajar): Puedes acuartelar hasta 3 unidades en esta carta. (En tablero): Las cartas acuarteladas en esta carta ganan 1 de defensa y ataque por única vez luego de ser desacuarteladas.",
  "alineamientoTexto": "Bélico"
 },
 "AHA-33": {
  "nombre": "Primera Estrella - del Reinicio",
  "expansion": "AHAHO",
  "tipo": "suceso",
  "archivo": "primera_estrella",
  "elemento": [
   "luz"
  ],
  "alineamiento": "bendito",
  "costo": {
   "creencia": 4
  },
  "acciones": [
   "reaccion",
   "emboscar"
  ],
  "efecto": "(Al activar): Gana 3 de Alimento, 3 de Capital y busca en tu Mazo Principal un Suceso elemento LUZ y agrégalo a tu mano.",
  "leyenda": "Encomendada por Pachacamac",
  "alineamientoTexto": "Bendito"
 },
 "AHA-40": {
  "nombre": "Sachayoj",
  "expansion": "AHAHO",
  "tipo": "unidad",
  "archivo": "sachayoj",
  "especie": "sobrenatural",
  "clase": "comun",
  "movil": true,
  "defensa": 5,
  "ataque": 4,
  "naturaleza": "masculino",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "espectro",
  "pv": 3,
  "brio": "Vivo",
  "costo": {
   "creencia": 1,
   "capital": 2
  },
  "acciones": [],
  "efecto": "(Al bajar): Ganas 3 de Alimento. (En tablero): Si una Estructura Elemento TIERRA en TU tablero es derrotada puedes descartar esta carta en su lugar y mantener la Estructura en tu tablero. El oponente ganará los puntos de victoria de esta carta.",
  "alineamientoTexto": "Espectro",
  "sobrenatural": true
 },
 "AHA-19": {
  "nombre": "Templo del Sol",
  "expansion": "AHAHO",
  "tipo": "estructura",
  "archivo": "templo_del_sol",
  "movil": false,
  "defensa": 6,
  "ataque": 0,
  "elemento": [
   "luz"
  ],
  "alineamiento": "sagrado",
  "pv": 4,
  "brio": "Inactiva",
  "genera": {
   "creencia": 4
  },
  "acciones": [
   "acuartelar"
  ],
  "acuartelar": "2 Unid. humanas común espiritista",
  "efecto": "(Al bajar): Agrega una carta elemento luz de tu mazo principal a tu mano.",
  "leyenda": "Consagrado al Dios Inti por y para Siempre",
  "alineamientoTexto": "Sagrado"
 },
 "AHA-06": {
  "nombre": "Willak Uma - Inca",
  "expansion": "AHAHO",
  "tipo": "unidad",
  "archivo": "willak_uma_inca",
  "especie": "humano",
  "clase": "imperial",
  "movil": true,
  "defensa": 2,
  "ataque": 1,
  "naturaleza": "masculino",
  "elemento": [
   "luz"
  ],
  "alineamiento": "espiritista",
  "pv": 3,
  "brio": "Vivo",
  "genera": {
   "creencia": 1,
   "capital": 1
  },
  "acciones": [
   "agrupar"
  ],
  "efecto": "(Al bajar): Puedes bajar 1 Unidad Sobrenatural que NO sea Elemento OSCURIDAD reduciendo su coste de creencia en 2. (En tablero): Esta carta es inmune a objetos y sucesos OSCURIDAD.",
  "alineamientoTexto": "Espiritista",
  "sobrenatural": false
 },
 "AHA-39": {
  "nombre": "Xalpen la Insaciable",
  "expansion": "AHAHO",
  "tipo": "unidad",
  "archivo": "xalpen",
  "especie": "sobrenatural",
  "clase": "imperial",
  "movil": true,
  "defensa": 1,
  "ataque": 8,
  "naturaleza": "femenino",
  "elemento": [
   "oscuridad"
  ],
  "alineamiento": "deidad",
  "pv": 7,
  "brio": "Vivo",
  "costo": {
   "creencia": 6
  },
  "costoExtra": "2 Unidades Humanas",
  "acciones": [],
  "efecto": "(Al bajar): Envía todas las cartas humanas Común o Especial del tablero al Abismo. (En batalla): Puedes enviar hasta 2 unidades humanas de TU tablero o Reserva al Abismo o Mausoleo para aumentar 1 de ataque a esta carta por este turno.",
  "leyenda": "Del Abismo surge la Muerte",
  "alineamientoTexto": "Deidad",
  "sobrenatural": true
 },
 "ENC-01": {
  "nombre": "Aldeana",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "aldeana",
  "especie": "humano",
  "clase": "comun",
  "movil": true,
  "defensa": 1,
  "ataque": 1,
  "naturaleza": "femenino",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "peon",
  "pv": 0,
  "brio": "Vivo",
  "genera": {
   "alimento": 1,
   "creencia": 2
  },
  "acciones": [
   "agrupar"
  ],
  "efecto": "",
  "alineamientoTexto": "Peón",
  "sobrenatural": false
 },
 "ENC-02": {
  "nombre": "Aldeano",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "aldeano",
  "especie": "humano",
  "clase": "comun",
  "movil": true,
  "defensa": 1,
  "ataque": 1,
  "naturaleza": "masculino",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "peon",
  "pv": 0,
  "brio": "Vivo",
  "genera": {
   "capital": 1,
   "creencia": 2
  },
  "acciones": [
   "agrupar"
  ],
  "efecto": "",
  "alineamientoTexto": "Peón",
  "sobrenatural": false
 },
 "ENC-03": {
  "nombre": "Arcabucero del Conquistador",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "arcabucero_del_emperador",
  "especie": "humano",
  "clase": "especial",
  "movil": true,
  "defensa": 4,
  "ataque": 4,
  "naturaleza": "masculino",
  "elemento": [
   "fuego"
  ],
  "alineamiento": "belico",
  "pv": 3,
  "brio": "Vivo",
  "costo": {
   "capital": 2,
   "alimento": 1
  },
  "acciones": [
   "demoledor"
  ],
  "efecto": "(Al bajar): Envía al Mausoleo 1 Unidad Humana o Animal Común o Especial de defensa 4 o menor del tablero.",
  "alineamientoTexto": "Bélico",
  "sobrenatural": false
 },
 "ENC-37": {
  "nombre": "Arcángel Uriel",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "arcangel_uriel",
  "especie": "sobrenatural",
  "clase": "imperial",
  "movil": true,
  "defensa": 4,
  "ataque": 6,
  "naturaleza": "masculino",
  "elemento": [
   "luz",
   "fuego"
  ],
  "alineamiento": "espectro",
  "pv": 5,
  "brio": "Vivo",
  "costo": {
   "creencia": 6
  },
  "acciones": [
   "imparable"
  ],
  "efecto": "(Al bajar): Elige un efecto: 1. Mira el mazo de tu oponente y elige una carta Elemento OSCURIDAD y envíala al Abismo. 2. Selecciona 1 carta de TU mazo principal y 1 carta de TU mazo de Recursos, baraja los mazos y coloca la carta seleccionada en el tope del mazo (no puede ser Elemento OSCURIDAD).",
  "leyenda": "La Luz que Muestra el Camino",
  "alineamientoTexto": "Espectro",
  "sobrenatural": true
 },
 "ENC-04": {
  "nombre": "Ballestero Conquistador",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "ballestero",
  "especie": "humano",
  "clase": "comun",
  "movil": true,
  "defensa": 3,
  "ataque": 2,
  "naturaleza": "masculino",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "belico",
  "pv": 2,
  "brio": "Vivo",
  "costo": {
   "alimento": 1,
   "capital": 2
  },
  "acciones": [],
  "efecto": "(En tablero): Una vez por turno puedes pagar hasta 3 de Capital para repartir 1 de Herida a Unidades Humanas y/o Animales por cada capital pagado.",
  "alineamientoTexto": "Bélico",
  "sobrenatural": false
 },
 "ENC-05": {
  "nombre": "Nuño el Heroico Cataclismo del Valor",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "bombero",
  "especie": "humano",
  "clase": "comun",
  "movil": true,
  "defensa": 1,
  "ataque": 1,
  "naturaleza": "masculino",
  "elemento": [
   "fuego"
  ],
  "alineamiento": "heroe",
  "pv": 1,
  "brio": "Vivo",
  "costo": {
   "alimento": 1,
   "creencia": 1,
   "capital": 3
  },
  "acciones": [
   "imparable"
  ],
  "efecto": "(En tablero): Al ser derrotada disminuye 6 puntos de ataque o defensa repartidos en las cartas del tablero a tu elección.",
  "alineamientoTexto": "Héroe",
  "sobrenatural": false
 },
 "ENC-06": {
  "nombre": "Caballero Conquistador",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "caballero_conquistador",
  "especie": "humano",
  "clase": "comun",
  "movil": true,
  "defensa": 3,
  "ataque": 4,
  "naturaleza": "masculino",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "belico",
  "pv": 4,
  "brio": "Vivo",
  "costo": {
   "alimento": 3
  },
  "acciones": [
   "emboscar",
   "agrupar"
  ],
  "efecto": "",
  "alineamientoTexto": "Bélico",
  "sobrenatural": false
 },
 "ENC-07": {
  "nombre": "Caballo Andaluz",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "caballoo_andaluz",
  "especie": "animal",
  "clase": "comun",
  "movil": true,
  "defensa": 2,
  "ataque": 2,
  "naturaleza": null,
  "elemento": [
   "tierra"
  ],
  "alineamiento": "alimana",
  "pv": 3,
  "brio": "Vivo",
  "costo": {
   "capital": 1,
   "alimento": 3
  },
  "acciones": [
   "emboscar"
  ],
  "efecto": "(En tablero): Puedes equipar permanentemente esta carta a una Unidad Humana y suma sus valores de ataque y defensa.",
  "alineamientoTexto": "Alimaña",
  "sobrenatural": false
 },
 "ENC-35": {
  "nombre": "Demonio Legión",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "demonio_legion",
  "especie": "sobrenatural",
  "clase": "comun",
  "movil": true,
  "defensa": 6,
  "ataque": 6,
  "naturaleza": null,
  "elemento": [
   "fuego"
  ],
  "alineamiento": "espectro",
  "pv": 6,
  "brio": "Vivo",
  "costo": {
   "creencia": 5
  },
  "acciones": [],
  "efecto": "(En tablero): Puedes equipar permanentemente esta carta a una Unidad Humana Común de ataque 3 o menor y suma sus valores de ataque y defensa.",
  "leyenda": "Mi nombre es Legión, porque somos muchos",
  "alineamientoTexto": "Espectro",
  "sobrenatural": true
 },
 "ENC-012": {
  "nombre": "Hombre de Fe",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "hombre_de_fe",
  "especie": "humano",
  "clase": "imperial",
  "movil": true,
  "defensa": 2,
  "ataque": 1,
  "naturaleza": "masculino",
  "elemento": [
   "tierra",
   "luz"
  ],
  "alineamiento": "espiritista",
  "pv": 2,
  "brio": "Vivo",
  "costo": {
   "alimento": 1
  },
  "acciones": [],
  "efecto": "(Al bajar): Elige un efecto: 1. Genera 2 de creencia. 2. Gana 1 punto de victoria.",
  "leyenda": "Espera grandes cosas de Dios, intenta grandes cosas para Dios",
  "alineamientoTexto": "Espiritista",
  "sobrenatural": false
 },
 "ENC-017": {
  "nombre": "Hoy te Convertís en Héroe",
  "expansion": "ENCUENTRO",
  "tipo": "suceso",
  "archivo": "hoy_te_convertis_en_heroe",
  "elemento": [
   "fuego"
  ],
  "alineamiento": "simple",
  "costo": {
   "creencia": 4,
   "capital": 2
  },
  "acciones": [],
  "efecto": "(Al activar): Busca en tu mazo Principal hasta 2 Unidades Humanas Especial y colócalas en el tablero.",
  "alineamientoTexto": "Simple"
 },
 "ENC-014": {
  "nombre": "La Sorgina",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "la_soergina",
  "especie": "humano",
  "clase": "comun",
  "movil": true,
  "defensa": 2,
  "ataque": 2,
  "naturaleza": "femenino",
  "elemento": [
   "oscuridad"
  ],
  "alineamiento": "espiritista",
  "pv": 2,
  "brio": "Vivo",
  "costo": {
   "alimento": 1,
   "creencia": 2
  },
  "acciones": [],
  "efecto": "(Al bajar): Puedes escoger una carta al azar de la mano del oponente y mandarla al Mausoleo. (En tablero): Cuando esta carta es derrotada, saca una carta de Elemento OSCURIDAD del mazo Principal a tu mano.",
  "alineamientoTexto": "Espiritista",
  "sobrenatural": false
 },
 "ENC-34": {
  "nombre": "León de San Marcos",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "leon_de_san_maros",
  "especie": "sobrenatural",
  "clase": "imperial",
  "movil": true,
  "defensa": 3,
  "ataque": 3,
  "naturaleza": "masculino",
  "elemento": [
   "viento",
   "luz"
  ],
  "alineamiento": "espectro",
  "pv": 4,
  "brio": "Vivo",
  "costo": {
   "creencia": 3
  },
  "acciones": [],
  "efecto": "(Al bajar): Busca en TU mazo Principal hasta 2 Unidades/Luz de ataque 3 o menor y bájalas gratis en TU tablero.",
  "alineamientoTexto": "Espectro",
  "sobrenatural": true
 },
 "ENC-032": {
  "nombre": "Monumento a los Caídos",
  "expansion": "ENCUENTRO",
  "tipo": "estructura",
  "archivo": "monumento_a_los_caidos",
  "movil": false,
  "defensa": 6,
  "ataque": 0,
  "elemento": [
   "fuego"
  ],
  "alineamiento": "simple",
  "pv": 4,
  "brio": "Inactiva",
  "genera": {
   "creencia": 3
  },
  "acciones": [],
  "efecto": "(En tablero): Convierte a todas las unidades Humanas Peón en Bélico y aumenta permanente 1 de ataque y 1 de defensa a todas las unidades Humanas Bélico.",
  "leyenda": "Dedicados a los Héroes Caídos",
  "alineamientoTexto": "Simple"
 },
 "ENC-019": {
  "nombre": "Refuerzo",
  "expansion": "ENCUENTRO",
  "tipo": "suceso",
  "archivo": "refuerzo",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "simple",
  "costo": {
   "creencia": 3,
   "capital": 1
  },
  "acciones": [],
  "efecto": "(Al activar): Puedes atacar nuevamente con cada carta de ataque 5 o menor. Solo en este segundo ataque cada carta gana 1 de ataque. (No puedes Agrupar)",
  "alineamientoTexto": "Simple"
 },
 "ENC-33": {
  "nombre": "San Jorge",
  "expansion": "ENCUENTRO",
  "tipo": "unidad",
  "archivo": "san_jorge",
  "especie": "sobrenatural",
  "clase": "especial",
  "movil": true,
  "defensa": 3,
  "ataque": 5,
  "naturaleza": "masculino",
  "elemento": [
   "tierra",
   "luz"
  ],
  "alineamiento": "belico",
  "pv": 5,
  "brio": "Vivo",
  "costo": {
   "creencia": 4
  },
  "acciones": [],
  "efecto": "(En tablero): Aumenta 1 punto de defensa a todas las Unidades Humanas de elemento luz. (En tablero): Todas las Unidades Humanas de cualquier elemento excepto oscuridad se considerarán de elemento luz.",
  "alineamientoTexto": "Bélico",
  "sobrenatural": true
 },
 "ENC-030": {
  "nombre": "Santa Catedral",
  "expansion": "ENCUENTRO",
  "tipo": "estructura",
  "archivo": "santa_catedral",
  "movil": false,
  "defensa": 7,
  "ataque": 0,
  "elemento": [
   "tierra",
   "luz"
  ],
  "alineamiento": "sagrado",
  "pv": 6,
  "brio": "Inactivo",
  "genera": {
   "creencia": 5
  },
  "acciones": [
   "acuartelar"
  ],
  "acuartelar": "3 Unid. Humana",
  "efecto": "(En tablero): Cuando esta carta es destruida las cartas acuarteladas se envían al mazo de reserva.",
  "alineamientoTexto": "Sagrado"
 },
 "ENC-040": {
  "nombre": "Santa Cruz Divina",
  "expansion": "ENCUENTRO",
  "tipo": "objeto",
  "archivo": "santa_cruz_divina",
  "elemento": [
   "luz"
  ],
  "alineamiento": "herramienta",
  "costo": {
   "creencia": 4
  },
  "acciones": [
   "emboscar",
   "hospitalidad"
  ],
  "hospitalidad": 1,
  "efecto": "(Al activar): Busca una carta Objeto o Suceso de Elemento LUZ de TU Mausoleo y envíala a tu mano (excepto \"Santa Cruz Divina\"). (En tablero): Disminuye 1 de ataque y 1 de defensa a cartas Sobrenaturales de cualquier Elemento excepto LUZ.",
  "alineamientoTexto": "Herramienta"
 },
 "ENC-026": {
  "nombre": "Santo Grial",
  "expansion": "ENCUENTRO",
  "tipo": "objeto",
  "archivo": "santo_grial",
  "elemento": [
   "luz"
  ],
  "alineamiento": "herramienta",
  "costo": {
   "creencia": 3
  },
  "acciones": [
   "emboscar",
   "reaccion"
  ],
  "efecto": "(Al activar): Elige un efecto: 1. Anula un Ataque Enemigo. 2. Anula el efecto de una carta de Elemento OSCURIDAD. 3. Coloca en el tablero una Unidad Humana Común/Especial del Mausoleo.",
  "alineamientoTexto": "Herramienta"
 },
 "ENC-020": {
  "nombre": "Tentación Lujuriosa",
  "expansion": "ENCUENTRO",
  "tipo": "suceso",
  "archivo": "tentacion_lujuriosa",
  "elemento": [
   "oscuridad"
  ],
  "alineamiento": "maldito",
  "costo": {},
  "costoExtra": "1 Unid. Hum. Espiritista y 1 Unid. Hum. Femenina (de tu mazo)",
  "acciones": [
   "reaccion",
   "emboscar"
  ],
  "efecto": "(Al activar): Elige un efecto: 1. Coloca una Unid. Sobrenatural Elemento OSCURIDAD de ataque 6 o menor. 2. Envía al Abismo hasta 1 Unid. Humana Espiritista del tablero o mano oponente y resta 2 de creencia al oponente.",
  "leyenda": "La carne es débil",
  "alineamientoTexto": "Maldito"
 },
 "GL-19": {
  "nombre": "Andamio Agrícola",
  "expansion": "GRAN LITORAL",
  "tipo": "estructura",
  "archivo": "andamio_agricola",
  "movil": false,
  "defensa": 6,
  "ataque": 0,
  "elemento": [
   "tierra"
  ],
  "alineamiento": "simple",
  "pv": 4,
  "brio": "Inactiva",
  "genera": {
   "alimento": 6
  },
  "acciones": [],
  "efecto": "(Al bajar): Toma 1 carta de TU mazo de Recursos; puedes colocarla o jugarla como Recurso. (En batalla): Si esta carta es derrotada puedes buscar un Suceso Elemento TIERRA de TU mazo Principal y activarlo gratis.",
  "alineamientoTexto": "Simple"
 },
 "GL-18": {
  "nombre": "Apacheta Santa",
  "expansion": "GRAN LITORAL",
  "tipo": "estructura",
  "archivo": "apacheta",
  "movil": false,
  "defensa": 4,
  "ataque": 0,
  "elemento": [
   "tierra"
  ],
  "alineamiento": "simple",
  "pv": 3,
  "brio": "Inactiva",
  "genera": {
   "capital": 5,
   "alimento": 2,
   "creencia": 1
  },
  "acciones": [
   "emboscar"
  ],
  "efecto": "(Al bajar): Puedes pagar X cantidad de Creencia para generar X cantidad de alimento o capital por cada creencia pagada. (En batalla): Cada Unidad Humana Común en TU tablero gana 1 punto de ataque o defensa.",
  "alineamientoTexto": "Simple"
 },
 "GL-10": {
  "nombre": "Báculo del Poder",
  "expansion": "GRAN LITORAL",
  "tipo": "objeto",
  "archivo": "baculo_de_poder",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "armamento",
  "costo": {
   "capital": 1,
   "creencia": 2
  },
  "acciones": [
   "emboscar"
  ],
  "efecto": "(Al equipar): Aumenta 2 puntos de ataque y 1 punto de defensa a una Unidad Humana Espiritista. (Al equipar): La carta equipada con esta obtiene \"Inbloqueable\".",
  "alineamientoTexto": "Armamento"
 },
 "GL-02": {
  "nombre": "Beata Benefactora Jesuita",
  "expansion": "GRAN LITORAL",
  "tipo": "unidad",
  "archivo": "beata",
  "especie": "humano",
  "clase": "comun",
  "movil": true,
  "defensa": 3,
  "ataque": 2,
  "naturaleza": "femenino",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "espiritista",
  "pv": 3,
  "brio": "Vivo",
  "genera": {
   "alimento": 2,
   "creencia": 2
  },
  "acciones": [],
  "efecto": "(Al bajar): Elige un efecto: 1. Si no tienes cartas en tu mano, toma 2 cartas del tope del mazo de Recursos o Principal. 2. Si tienes 2 o menos cartas en TU tablero, toma una carta del mazo Principal; si es una Unid. Común puedes colocarla en el tablero.",
  "alineamientoTexto": "Espiritista",
  "sobrenatural": false
 },
 "GL-17": {
  "nombre": "Capilla Jesuita",
  "expansion": "GRAN LITORAL",
  "tipo": "estructura",
  "archivo": "capilla_jesuita",
  "movil": false,
  "defensa": 3,
  "ataque": 0,
  "elemento": [
   "tierra"
  ],
  "alineamiento": "simple",
  "pv": 2,
  "brio": "Activa",
  "genera": {
   "creencia": 5
  },
  "acciones": [
   "acuartelar"
  ],
  "acuartelar": "3 Unid. Humanas Común",
  "efecto": "(Al bajar): Si tienes al menos 1 Unidad Espiritista en TU tablero puedes generar 1 recurso a elección. (En tablero): Disminuye 1 de ataque a todas las Unidades Elemento OSCURIDAD en el tablero.",
  "alineamientoTexto": "Simple"
 },
 "GL-03": {
  "nombre": "Illa Maga Nocturna de los Cerros",
  "expansion": "GRAN LITORAL",
  "tipo": "unidad",
  "archivo": "illa",
  "especie": "humano",
  "clase": "especial",
  "movil": true,
  "defensa": 2,
  "ataque": 2,
  "naturaleza": "femenino",
  "elemento": [
   "tierra"
  ],
  "alineamiento": "espiritista",
  "pv": 3,
  "brio": "Vivo",
  "costo": {
   "creencia": 2,
   "alimento": 1
  },
  "acciones": [
   "demoledor"
  ],
  "efecto": "(Al bajar): Elige un efecto: 1. Quita 3 puntos de Herida y Contusión a una Unidad Humana elemento TIERRA. 2. Inflige 2 puntos de Herida o Contusión a una Unidad Humana Común o Especial.",
  "alineamientoTexto": "Espiritista",
  "sobrenatural": false
 },
 "GL-12": {
  "nombre": "Infiltración Destructiva",
  "expansion": "GRAN LITORAL",
  "tipo": "suceso",
  "archivo": "inflitracion_destruciva",
  "elemento": [
   "fuego"
  ],
  "alineamiento": "simple",
  "costo": {
   "capital": 3
  },
  "acciones": [
   "emboscar"
  ],
  "efecto": "(Al activar): Envía al Mausoleo una Estructura del Tablero y selecciona un jugador; ese jugador pierde 1 de cada recurso. Luego TÚ envías al Mausoleo una carta de tu mano.",
  "alineamientoTexto": "Simple"
 },
 "GL-16": {
  "nombre": "Pombero - El Señor de la Noche",
  "expansion": "GRAN LITORAL",
  "tipo": "unidad",
  "archivo": "pombero",
  "especie": "sobrenatural",
  "clase": "especial",
  "movil": true,
  "defensa": 4,
  "ataque": 5,
  "naturaleza": "masculino",
  "elemento": [
   "tierra",
   "oscuridad"
  ],
  "alineamiento": "criatura",
  "pv": 5,
  "brio": "Vivo",
  "costo": {
   "alimento": 2,
   "creencia": 6
  },
  "acciones": [
   "emboscar",
   "demoledor"
  ],
  "efecto": "(Al bajar): Envía al Mausoleo hasta 2 Unidades Acuarteladas de ataque o defensa 3 o menor. (En batalla): Si atacas directamente a un oponente puedes seleccionar una de SUS Unidades Humanas Común o Especial de ataque 4 o menor y enviarla al mazo Principal correspondiente, por única vez.",
  "alineamientoTexto": "Criatura",
  "sobrenatural": true
 },
 "GL-04": {
  "nombre": "Okañyva - Rastreadora Guaraní",
  "expansion": "GRAN LITORAL",
  "tipo": "unidad",
  "archivo": "rastreadora",
  "especie": "humano",
  "clase": "especial",
  "movil": true,
  "defensa": 3,
  "ataque": 4,
  "naturaleza": "femenino",
  "elemento": [
   "tierra",
   "agua"
  ],
  "alineamiento": "belico",
  "pv": 4,
  "brio": "Vivo",
  "costo": {
   "alimento": 2,
   "capital": 2
  },
  "acciones": [
   "emboscar"
  ],
  "efecto": "(Al bajar): Elige un efecto: 1. Mira la mano de tu oponente y selecciona una Unidad Humana o Animal Común o Especial y envíala al Mausoleo. 2. Busca una Unidad Humana o Animal Común o Especial de tu mazo principal y agrégala a tu mano.",
  "alineamientoTexto": "Bélico",
  "sobrenatural": false
 },
 "GL-06": {
  "nombre": "Gran Rococó de Yunga - Enviado de Hampatu",
  "expansion": "GRAN LITORAL",
  "tipo": "unidad",
  "archivo": "rococo",
  "especie": "animal",
  "clase": "comun",
  "movil": true,
  "defensa": 0,
  "ataque": 2,
  "naturaleza": null,
  "elemento": [
   "tierra",
   "agua"
  ],
  "alineamiento": "alimana",
  "pv": 2,
  "brio": "Vivo",
  "costo": {
   "alimento": 2,
   "creencia": 2
  },
  "acciones": [
   "emboscar",
   "agrupar"
  ],
  "efecto": "Agrupar (Animal Común). (Al bajar): Coloca hasta 3 Unidades con \"Hampatu\" en su nombre de TU mazo Principal al tablero. (En mausoleo): Al ser derrotada toma una carta del tope del mazo Principal o de Recursos.",
  "alineamientoTexto": "Alimaña",
  "sobrenatural": false
 },
 "GL-07": {
  "nombre": "San Muerte",
  "expansion": "GRAN LITORAL",
  "tipo": "unidad",
  "archivo": "san_muerte",
  "especie": "sobrenatural",
  "clase": "comun",
  "movil": false,
  "defensa": 4,
  "ataque": 3,
  "naturaleza": "masculino",
  "elemento": [
   "luz"
  ],
  "alineamiento": "espectro",
  "pv": 4,
  "brio": "No muerto",
  "costo": {
   "creencia": 3
  },
  "costoExtra": "1 Unidad Espiritista en el Mausoleo",
  "acciones": [
   "hospitalidad",
   "inamovible"
  ],
  "hospitalidad": 1,
  "efecto": "(Al bajar): Cada jugador gana 1 de alimento y 1 de capital. (En batalla): Puedes enviar esta carta al Mausoleo para anular la fase de batalla del oponente.",
  "alineamientoTexto": "Espectro",
  "sobrenatural": true
 },
 "GL-08": {
  "nombre": "Gran Yaguareté de la Yunga Salvaje",
  "expansion": "GRAN LITORAL",
  "tipo": "unidad",
  "archivo": "yaguarete",
  "especie": "animal",
  "clase": "imperial",
  "movil": true,
  "defensa": 2,
  "ataque": 5,
  "naturaleza": null,
  "elemento": [
   "tierra"
  ],
  "alineamiento": "fiera",
  "pv": 4,
  "brio": "Vivo",
  "costo": {
   "alimento": 4
  },
  "acciones": [
   "emboscar"
  ],
  "efecto": "(Al bajar): Inflige 2 de Herida a una Unidad Humana o Animal. (En batalla): Si derrotas una Unidad Humana o Animal puedes quitar 2 puntos de Herida o Contusión a esta carta.",
  "alineamientoTexto": "Fiera",
  "sobrenatural": false
 },
 "GL-14": {
  "nombre": "Yasy Yateré - Cuarto Hijo Maldito",
  "expansion": "GRAN LITORAL",
  "tipo": "unidad",
  "archivo": "yasi",
  "especie": "sobrenatural",
  "clase": "imperial",
  "movil": true,
  "defensa": 3,
  "ataque": 4,
  "naturaleza": "masculino",
  "elemento": [
   "tierra",
   "oscuridad"
  ],
  "alineamiento": "deidad",
  "pv": 5,
  "brio": "Vivo",
  "costo": {
   "alimento": 1,
   "creencia": 4
  },
  "acciones": [
   "emboscar"
  ],
  "efecto": "(Al bajar): Toma hasta 2 Unidades Humanas de ataque 4 o menor del mazo de Reserva del oponente y envíalas al Abismo.",
  "leyenda": "Hay que dormir la siesta",
  "alineamientoTexto": "Deidad",
  "sobrenatural": true
 },
 "VP-16": {
  "nombre": "Círculo del Hain",
  "expansion": "VIEJA PATAGONIA",
  "tipo": "estructura",
  "archivo": "circulo_del_hain_16",
  "movil": false,
  "defensa": 3,
  "ataque": 3,
  "elemento": [
   "oscuridad",
   "luz"
  ],
  "alineamiento": "maligno",
  "pv": 5,
  "brio": "Activo",
  "genera": {
   "creencia": 4
  },
  "acciones": [
   "acuartelar"
  ],
  "acuartelar": "3 Unid. Sobrenaturales",
  "efecto": "(Al bajar): Coloca una Unidad Sobrenatural Común de TU mazo Sobrenatural en el tablero y acuartela esa Unidad en esta carta. (En mausoleo): Al ser derrotada esta carta puedes bajar una Unidad Sobrenatural y reducir en 2 el coste de cualquier recurso requerido para su bajada.",
  "alineamientoTexto": "Maligno"
 },
 "VP-18": {
  "nombre": "Cueva de las Manos - Hogar del Patagón",
  "expansion": "VIEJA PATAGONIA",
  "tipo": "estructura",
  "archivo": "cueva_patagon_18",
  "movil": false,
  "defensa": 5,
  "ataque": 0,
  "elemento": [
   "tierra",
   "viento"
  ],
  "alineamiento": "maravilla",
  "pv": 5,
  "brio": "Inactiva",
  "genera": {
   "creencia": 1,
   "capital": 4
  },
  "acciones": [
   "acuartelar"
  ],
  "acuartelar": "5 Unidades Humanas o Animales Común",
  "efecto": "(Al bajar): Busca una carta Elemento VIENTO en tu mazo principal y actívala o bájala sin pagar su costo. (En mausoleo): Si no tienes cartas de Elemento VIENTO en tu mano o tablero puedes agregar esta a tu mano.",
  "alineamientoTexto": "Maravilla"
 },
 "VP-05": {
  "nombre": "Gaucho Errante - El Baquiano",
  "expansion": "VIEJA PATAGONIA",
  "tipo": "unidad",
  "archivo": "gaucho_errante_baquiano_05",
  "especie": "humano",
  "clase": "comun",
  "movil": true,
  "defensa": 5,
  "ataque": 6,
  "naturaleza": "masculino",
  "elemento": [
   "viento",
   "tierra"
  ],
  "alineamiento": "peon",
  "pv": 5,
  "brio": "Vivo",
  "costo": {
   "alimento": 2,
   "capital": 3
  },
  "acciones": [],
  "efecto": "(Al bajar): Inflige 2 de herida a una Unidad Humana en el tablero. (En batalla): Selecciona una carta del tablero Humana o Animal de ataque o defensa 4 o menor; esta no podrá atacar en el siguiente turno.",
  "leyenda": "Vivir Libre como el Pájaro del cielo",
  "alineamientoTexto": "Peón",
  "sobrenatural": false
 },
 "VP-02": {
  "nombre": "Niña del Fuego",
  "expansion": "VIEJA PATAGONIA",
  "tipo": "unidad",
  "archivo": "nina_del_fuego_02",
  "especie": "humano",
  "clase": "especial",
  "movil": true,
  "defensa": 2,
  "ataque": 2,
  "naturaleza": "femenino",
  "elemento": [
   "fuego"
  ],
  "alineamiento": "peon",
  "pv": 1,
  "brio": "Vivo",
  "costo": {
   "creencia": 2
  },
  "acciones": [
   "agrupar"
  ],
  "efecto": "(En tablero): Aumenta 1 de ataque a esta carta por cada carta Elemento FUEGO en el tablero. (En batalla): Si atacas a una carta Elemento VIENTO esta carta aumenta 1 de ataque al momento del combate.",
  "alineamientoTexto": "Peón",
  "sobrenatural": false
 },
 "VP-14": {
  "nombre": "Walichu - Antiguo Mal",
  "expansion": "VIEJA PATAGONIA",
  "tipo": "unidad",
  "archivo": "walichu_antiguo_mal_14",
  "especie": "sobrenatural",
  "clase": "imperial",
  "movil": true,
  "defensa": 5,
  "ataque": 7,
  "naturaleza": "masculino",
  "elemento": [
   "oscuridad"
  ],
  "alineamiento": "deidad",
  "pv": 7,
  "brio": "Vivo",
  "costo": {
   "creencia": 6
  },
  "acciones": [
   "reaccion"
  ],
  "efecto": "(Al bajar): Derrota una Estructura del tablero. (En tablero/batalla): Disminuye 2 de ataque a todas las Unidades Humanas Masculinas Común o Especial en el tablero y anula Agrupar.",
  "alineamientoTexto": "Deidad",
  "sobrenatural": true
 },
 "VP-10": {
  "nombre": "Zorro Gris del Sur",
  "expansion": "VIEJA PATAGONIA",
  "tipo": "unidad",
  "archivo": "zorro_gris_del_sur_10",
  "especie": "animal",
  "clase": "comun",
  "movil": true,
  "defensa": 0,
  "ataque": 1,
  "naturaleza": null,
  "elemento": [
   "tierra"
  ],
  "alineamiento": "alimana",
  "pv": 2,
  "brio": "Vivo",
  "costo": {
   "alimento": 1
  },
  "acciones": [
   "reaccion"
  ],
  "efecto": "(Al bajar): Envía al Mausoleo una Unidad Animal de defensa 3 o menor.",
  "alineamientoTexto": "Alimaña",
  "sobrenatural": false
 }
};
