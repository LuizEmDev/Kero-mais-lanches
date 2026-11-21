// "node:fs" e "node:path" não existem no navegador; a demonstração não usa arquivos.
export const mkdirSync = () => {}
export const writeFileSync = () => {}
export const rmSync = () => {}
export const existsSync = () => false
export const dirname = (p) => p
export const join = (...p) => p.join('/')
export default {}
