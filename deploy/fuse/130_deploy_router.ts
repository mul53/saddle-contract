import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy, getOrNull, log } = deployments
  const { libraryDeployer } = await getNamedAccounts()

  const router = await getOrNull("Router")
  if (router) {
    log(`reusing "Router" at ${router.address}`)
  } else {
    await deploy("Router", {
      from: libraryDeployer,
      log: true,
      skipIfAlreadyDeployed: true,
      waitConfirmations: 3,
    })
  }
}
export default func
func.tags = ["Router"]
