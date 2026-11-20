/* =========================================================
   CONTENIDO EDITABLE · ¿Quién eres? ¿Te conoces?
   Cambia aquí textos, colores, preguntas y emociones.
   (Los textos largos de cada nivel están en main.js → VIEWS)
   ========================================================= */
(function () {
  "use strict";

  var COLORS = { cortex: "#22f2ff", limbic: "#ffb347", reptilian: "#b26bff" };

  window.__BRAND__ = {
    name: "¿Quién eres? ¿Te conoces?",
    COLORS: COLORS,

    REGIONS: {
      reptilian: {
        name: "Cerebro reptiliano", tag: "Instinto", short: "Sobrevivir",
        motto: "El que te mantiene <em>vivo</em>",
        where: "Tronco encefálico y cerebelo", age: "+500 millones de años",
        functions: ["Respirar", "Ritmo cardíaco", "Dormir y despertar", "Reaccionar", "Sobrevivir"],
        body: [
          "Es la parte más antigua según el modelo de <b>Paul MacLean</b>. Está justo encima de donde empieza la médula espinal y empieza a trabajar en el útero: respirar, comer, dormir, despertar, llorar.",
          "Actúa rápido y sin pedir permiso. Reacciona a lo conocido, busca seguridad y huye de la amenaza. Entiende lo concreto y lo que ve, no los números ni las ideas abstractas: entiende de <b>peligro y alivio</b>."
        ],
        fact: "Mientras lees esto ajustó tu respiración, tu pulso y tu postura. No te consultó.",
        question: "¿Cuántas de tus reacciones de hoy fueron realmente elegidas?"
      },
      limbic: {
        name: "Sistema límbico", tag: "Emoción", short: "Sentir",
        motto: "El que siente <em>antes</em> de que pienses",
        where: "En el centro, bajo la corteza", age: "+200 millones de años",
        functions: ["Emociones", "Memoria", "Vínculos", "Alimentarse", "Reproducirse"],
        parts: [
          ["amygdala", "Amígdala", "La alarma. Detecta amenazas y dispara el miedo, las hormonas del estrés y la respuesta de luchar o huir."],
          ["hippocampus", "Hipocampo", "El archivista. Consolida la memoria: filtra qué recuerdas y qué olvidas."],
          ["hypothalamus", "Hipotálamo", "El regulador. Controla el sistema nervioso autónomo, libera hormonas y te adapta al entorno."],
          ["thalamus", "Tálamo", "La estación central. Casi todo lo que percibes pasa por aquí antes de llegar a la corteza."]
        ],
        body: [
          "Empieza a organizarse al nacer y se moldea durante los primeros seis años con tu experiencia, tu herencia y tu temperamento.",
          "No podemos razonar sin emociones: son señales biológicas que orientan tus decisiones <b>antes de que te des cuenta</b>. Aquí se fija la memoria emocional."
        ],
        fact: "Por eso tantas compras son emocionales primero… y racionales después, cuando hay que justificarlas.",
        question: "¿Qué emoción tomó la última decisión importante que tomaste?"
      },
      cortex: {
        name: "Neocórtex", tag: "Razón", short: "Pensar",
        motto: "El que se <em>cuenta</em> la historia",
        where: "La capa exterior y plegada", age: "≈100.000 años (forma humana)",
        functions: ["Lenguaje", "Lógica", "Aprendizaje", "Planificar", "Frenar impulsos"],
        body: [
          "Es la parte más joven y la sede del pensamiento abstracto. Aquí vive la <b>corteza prefrontal</b>: planifica, anticipa, percibe el tiempo y el contexto, y frena las acciones inadecuadas.",
          "Su superpoder es observarse a sí misma (<b>metacognición</b>). Su trampa: muchas veces llega tarde y se dedica a justificar lo que ya se decidió más abajo."
        ],
        fact: "Sus pliegues existen para que quepa más superficie: extendida, ocuparía un cuadrado de unos 50 × 50 cm.",
        question: "¿Decides con la razón… o usas la razón para explicar lo que ya decidiste?"
      }
    },

    PART_NAMES: {
      hemiL: ["Neocórtex", "Hemisferio izquierdo"], hemiR: ["Neocórtex", "Hemisferio derecho"],
      callosum: ["Cuerpo calloso", "El puente entre hemisferios"],
      cerebellum: ["Cerebelo", "Equilibrio y movimiento automático"],
      brainstem: ["Tronco encefálico", "Respiración, pulso, alerta"],
      thalamus: ["Tálamo", "Estación central de los sentidos"],
      amygdala: ["Amígdala", "La alarma del miedo"],
      hippocampus: ["Hipocampo y fórnix", "Memoria"],
      hypothalamus: ["Hipotálamo", "Hormonas y regulación"]
    },

    QUIZ: [
      "Revisaste el celular apenas abriste los ojos.",
      "Saltaste por un ruido inesperado.",
      "Compraste algo que no tenías planeado.",
      "Le respondiste mal a alguien que quieres.",
      "Elegiste qué comer hoy.",
      "Postergaste algo importante.",
      "Cambiaste de opinión después de pensarlo con calma."
    ],

    EMOTIONS: ["ansiedad", "cansancio", "calma", "curiosidad", "tristeza", "enojo", "alegría", "miedo", "ilusión"],

    /* Logros del juego: id → [título, puntos] */
    ACHIEVEMENTS: {
      reptilian: ["Conociste a tu Instinto", 150],
      limbic: ["Conociste a tu Emoción", 150],
      cortex: ["Conociste a tu Razón", 150],
      pulse: ["Viste llegar tarde a la razón", 200],
      anatomist: ["Anatomista: tocaste 5 estructuras", 250],
      quiz: ["Espejo completado", 400],
      shadow: ["Integrador de sombras", 400],
      observer: ["Tercer observador", 500],
      final: ["Continuar: siempre", 1000]
    }
  };
})();
