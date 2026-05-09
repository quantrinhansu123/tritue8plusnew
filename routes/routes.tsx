import privateRoutes from "@/routes/privateRoutes";
import publicRoutes from "@/routes/publicRoutes";


const rootRoutes = [...privateRoutes, ...publicRoutes]

export default rootRoutes;
