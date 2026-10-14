/**
 * Lista de stop-words en espanol (rioplatense incluido).
 *
 * Son palabras muy frecuentes y de bajo valor semantico que se remueven antes
 * del analisis para quedarnos con los terminos relevantes. La lista es acotada
 * y editable; no pretende ser exhaustiva.
 */
export const SPANISH_STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'al', 'algo', 'algunas', 'algunos', 'ante', 'antes', 'aca', 'ahi',
  'como', 'con', 'contra', 'cual', 'cuando', 'de', 'del', 'desde', 'donde',
  'durante', 'e', 'el', 'ella', 'ellas', 'ellos', 'en', 'entre', 'era',
  'erais', 'eran', 'eras', 'eres', 'es', 'esa', 'esas', 'ese', 'eso', 'esos',
  'esta', 'estaba', 'estan', 'estas', 'este', 'esto', 'estos', 'fue', 'fueron',
  'ha', 'habia', 'han', 'hasta', 'hay', 'la', 'las', 'le', 'les', 'lo', 'los',
  'mas', 'me', 'mi', 'mis', 'mucho', 'muy', 'nada', 'ni', 'no', 'nos',
  'nosotros', 'o', 'os', 'otra', 'otras', 'otro', 'otros', 'para', 'pero',
  'poco', 'por', 'porque', 'que', 'quien', 'se', 'sea', 'segun', 'ser', 'si',
  'sin', 'sobre', 'solo', 'son', 'su', 'sus', 'tambien', 'tanto', 'te',
  'tiene', 'tienen', 'todo', 'todos', 'tu', 'tus', 'un', 'una', 'uno', 'unos',
  'vos', 'y', 'ya', 'yo',
]);
