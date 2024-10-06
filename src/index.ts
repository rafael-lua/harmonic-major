import { info, setFailed, setOutput } from "@actions/core"
import release from "./core/release"

const run = async () => {
    try {
        info("Release action started...")

        const newRelease = await release()

        if (newRelease) {
            setOutput("release", newRelease)
            info("New release created!")
        } else {
            info("No new release created!")
        }
    } catch (error) {
        setFailed(
            error instanceof Error ? error.message : `Unknown error: ${error}`,
        )
    }
}

run()
