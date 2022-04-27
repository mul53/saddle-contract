import { BigNumber, Signer } from "ethers"
import {
  MAX_UINT256,
  asyncForEach,
  getUserTokenBalance,
  getCurrentBlockTimestamp,
  BIG_NUMBER_1E18,
} from "./testUtils"
import { solidity } from "ethereum-waffle"
import { deployments } from "hardhat"

import { GenericERC20 } from "../build/typechain/GenericERC20"
import { LPToken } from "../build/typechain/LPToken"
import { Swap } from "../build/typechain/Swap"
import { Router } from "../build/typechain/Router"
import chai from "chai"

chai.use(solidity)
const { expect } = chai

describe("Swap with router", () => {
  let signers: Array<Signer>
  let swap1: Swap
  let swap2: Swap
  let router: Router
  let USDC: GenericERC20
  let USDT: GenericERC20
  let BUSD: GenericERC20
  let FUSD: GenericERC20
  let atUST: GenericERC20
  let lp1: LPToken
  let lp2: LPToken
  let owner: Signer
  let user1: Signer
  let user2: Signer
  let ownerAddress: string
  let user1Address: string
  let user2Address: string
  let swapStorage1: {
    initialA: BigNumber
    futureA: BigNumber
    initialATime: BigNumber
    futureATime: BigNumber
    swapFee: BigNumber
    adminFee: BigNumber
    lpToken: string
  }
  let swapStorage2: {
    initialA: BigNumber
    futureA: BigNumber
    initialATime: BigNumber
    futureATime: BigNumber
    swapFee: BigNumber
    adminFee: BigNumber
    lpToken: string
  }

  // Test Values
  const INITIAL_A_VALUE = 50
  const SWAP_FEE = 1e7
  const LP1_TOKEN_NAME = "Test LP1 Token Name"
  const LP1_TOKEN_SYMBOL = "TESTLP1"
  const LP2_TOKEN_NAME = "Test LP2 Token Name"
  const LP2_TOKEN_SYMBOL = "TESTLP2"
  const TOKENS1: GenericERC20[] = []
  const TOKENS2: GenericERC20[] = []

  const setupTest = deployments.createFixture(
    async ({ deployments, ethers }) => {
      const { get, deploy } = deployments
      await deployments.fixture() // ensure you start from a fresh deployments

      TOKENS1.length = 0
      TOKENS2.length = 0
      signers = await ethers.getSigners()
      owner = signers[0]
      user1 = signers[1]
      user2 = signers[2]
      ownerAddress = await owner.getAddress()
      user1Address = await user1.getAddress()
      user2Address = await user2.getAddress()

      // USDC = await ethers.getContract("USDC")
      // USDT = await ethers.getContract("USDT")
      // atUST = await ethers.getContract("atUST")
      // FUSD = await ethers.getContract("FUSD")
      // BUSD = await ethers.getContract("BUSD")
      const erc20Factory = await ethers.getContractFactory("GenericERC20")

      USDC = (await erc20Factory.deploy(
        "USD Coin",
        "USDC",
        "6",
      )) as GenericERC20
      USDT = (await erc20Factory.deploy(
        "USD Tether",
        "USDT",
        "6",
      )) as GenericERC20
      BUSD = (await erc20Factory.deploy(
        "Binance USD",
        "BUSD",
        "6",
      )) as GenericERC20
      atUST = (await erc20Factory.deploy(
        "Terra USD",
        "atUST",
        "18",
      )) as GenericERC20
      FUSD = (await erc20Factory.deploy(
        "Fuse Dollar",
        "FUSD",
        "18",
      )) as GenericERC20

      TOKENS1.push(BUSD, USDC, USDT)
      TOKENS2.push(FUSD, USDT, atUST)

      // Mint dummy tokens
      await asyncForEach(
        [ownerAddress, user1Address, user2Address],
        async (address) => {
          await BUSD.mint(address, String(1e20))
          await USDC.mint(address, String(1e8))
          await USDT.mint(address, String(1e8))
          await FUSD.mint(address, String(1e20))
          await atUST.mint(address, String(1e20))
        },
      )

      const amplificationUtils = await ethers.getContract("AmplificationUtils")
      const swapUtils = await ethers.getContract("SwapUtils")
      // Get Swap contract
      const swapFactory = await ethers.getContractFactory("Swap", {
        libraries: {
          AmplificationUtils: amplificationUtils.address,
          SwapUtils: swapUtils.address,
        },
      })
      swap1 = (await swapFactory.deploy()) as Swap
      swap2 = (await swapFactory.deploy()) as Swap

      await swap1.initialize(
        TOKENS1.map((token) => token.address),
        [18, 6, 6],
        LP1_TOKEN_NAME,
        LP1_TOKEN_SYMBOL,
        INITIAL_A_VALUE,
        SWAP_FEE,
        0,
        (
          await get("LPToken")
        ).address,
      )
      await swap2.initialize(
        TOKENS2.map((token) => token.address),
        [18, 6, 18],
        LP2_TOKEN_NAME,
        LP2_TOKEN_SYMBOL,
        INITIAL_A_VALUE,
        SWAP_FEE,
        0,
        (
          await get("LPToken")
        ).address,
      )

      expect(await swap1.getVirtualPrice()).to.be.eq(0)
      expect(await swap2.getVirtualPrice()).to.be.eq(0)

      swapStorage1 = await swap1.swapStorage()
      swapStorage2 = await swap2.swapStorage()

      lp1 = (await ethers.getContractAt(
        "LPToken",
        swapStorage1.lpToken,
      )) as LPToken
      lp2 = (await ethers.getContractAt(
        "LPToken",
        swapStorage2.lpToken,
      )) as LPToken

      await asyncForEach([owner, user1, user2], async (signer) => {
        await USDC.connect(signer).approve(swap1.address, MAX_UINT256)
        await USDT.connect(signer).approve(swap1.address, MAX_UINT256)
        await BUSD.connect(signer).approve(swap1.address, MAX_UINT256)
      })
      await asyncForEach([owner, user1, user2], async (signer) => {
        await USDT.connect(signer).approve(swap2.address, MAX_UINT256)
        await FUSD.connect(signer).approve(swap2.address, MAX_UINT256)
        await atUST.connect(signer).approve(swap2.address, MAX_UINT256)
      })

      // Populate the pools with initial liquidity
      await swap1.addLiquidity(
        [String(50e18), String(50e6), String(50e6)],
        0,
        MAX_UINT256,
      )
      await swap2.addLiquidity(
        [String(50e18), String(50e6), String(50e18)],
        0,
        MAX_UINT256,
      )

      expect(await swap1.getTokenBalance(0)).to.be.eq(String(50e18))
      expect(await swap1.getTokenBalance(1)).to.be.eq(String(50e6))
      expect(await swap1.getTokenBalance(2)).to.be.eq(String(50e6))
      expect(await getUserTokenBalance(owner, lp1)).to.be.eq(String(150e18))

      expect(await swap2.getTokenBalance(0)).to.be.eq(String(50e18))
      expect(await swap2.getTokenBalance(1)).to.be.eq(String(50e6))
      expect(await swap2.getTokenBalance(2)).to.be.eq(String(50e18))
      expect(await getUserTokenBalance(owner, lp2)).to.be.eq(String(150e18))

      // Deploy router
      await deploy("Router", {
        from: ownerAddress,
        contract: "Router",
        skipIfAlreadyDeployed: true,
      })
      router = await ethers.getContract("Router")
    },
  )

  beforeEach(async () => {
    await setupTest()
  })

  describe("swapWithRoute", () => {
    it("Swap in a single pool", async () => {
      // Test swapping 1 BUSD for USDC in the swap1 pool using the router
      const calcTokenAmountWithinPool = await swap1.calculateSwap(
        0,
        1,
        BIG_NUMBER_1E18,
      )
      const calcTokenAmountRouter = await router.calculateAndCheckSwapRoute(
        [swap1.address],
        [BUSD.address, USDC.address],
        BIG_NUMBER_1E18,
      )
      expect(calcTokenAmountRouter[0]).to.be.eq(BIG_NUMBER_1E18)
      expect(calcTokenAmountRouter[1]).to.be.eq(calcTokenAmountWithinPool)

      const usdcBalanceBefore = await getUserTokenBalance(user1, USDC)

      await BUSD.connect(user1).approve(router.address, BIG_NUMBER_1E18)
      await router
        .connect(user1)
        .swapWithRoute(
          [swap1.address],
          [BUSD.address, USDC.address],
          BIG_NUMBER_1E18,
          calcTokenAmountWithinPool,
          (await getCurrentBlockTimestamp()) + 60,
        )

      const usdcBalanceAfter = await getUserTokenBalance(user1, USDC)
      expect(usdcBalanceAfter.sub(usdcBalanceBefore)).to.be.eq(
        calcTokenAmountWithinPool,
      )
    })

    it("Swap in two pools", async () => {
      // Test swapping 1 BUSD to FUSD using Router
      // The router should swap 1 BUSD for x USDT on swap1 and then x USDT to FUSD on swap2

      // TOKENS1.push(BUSD, USDC, USDT)
      // TOKENS2.push(FUSD, USDT, atUST)

      const calcPool1BusdToUsdt = await swap1.calculateSwap(
        0,
        2,
        BIG_NUMBER_1E18,
      )
      const calcPool2UsdtToFusd = await swap1.calculateSwap(
        1,
        0,
        calcPool1BusdToUsdt,
      )
      const calcTokenAmountRouter = await router.calculateAndCheckSwapRoute(
        [swap1.address, swap2.address],
        [BUSD.address, USDT.address, FUSD.address],
        BIG_NUMBER_1E18,
      )
      expect(calcTokenAmountRouter[0]).to.be.eq(BIG_NUMBER_1E18)
      expect(calcTokenAmountRouter[1]).to.be.eq(calcPool1BusdToUsdt)
      expect(calcTokenAmountRouter[2]).to.be.eq(calcPool2UsdtToFusd)

      const fusdBalanceBefore = await getUserTokenBalance(user1, FUSD)

      await BUSD.connect(user1).approve(router.address, BIG_NUMBER_1E18)
      await router
        .connect(user1)
        .swapWithRoute(
          [swap1.address, swap2.address],
          [BUSD.address, USDT.address, FUSD.address],
          BIG_NUMBER_1E18,
          calcPool2UsdtToFusd,
          (await getCurrentBlockTimestamp()) + 60,
        )

      const fusdBalanceAfter = await getUserTokenBalance(user1, FUSD)
      expect(fusdBalanceAfter.sub(fusdBalanceBefore)).to.be.eq(
        calcPool2UsdtToFusd,
      )
    })
  })
})
