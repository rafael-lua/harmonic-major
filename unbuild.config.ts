import { defineBuildConfig } from "unbuild"

export default defineBuildConfig({
    failOnWarn: false,
    rollup: {
        resolve: {
            preferBuiltins: true,
            moduleDirectories: ["node_modules"],
        },
        commonjs: {
            include: ["node_modules/**"],
        },
    },
    externals: [],
})
