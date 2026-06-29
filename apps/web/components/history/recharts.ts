// Re-export de los primitivos de recharts que usa la gráfica de Historial.
//
// `recharts` vive en `packages/ui/node_modules` (es dependencia del paquete
// `@workspace/ui`, que lo trae por el componente `chart`). NO está hoisteado a
// la raíz ni instalado en `apps/web`, así que un `import ... from "recharts"`
// no resuelve para tsc desde esta app. En runtime sí resuelve porque
// `transpilePackages: ["@workspace/ui"]` deja que el bundler siga las deps del
// paquete. Centralizamos aquí la resolución (vía el path del paquete UI) para
// que el resto de archivos importe primitivos con un alias estable.
export {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "../../../../packages/ui/node_modules/recharts";
