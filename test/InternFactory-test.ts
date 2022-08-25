import { expect } from "chai";
import { ethers } from "hardhat";

const toWei = (value: any) => ethers.utils.parseEther(value.toString());

const dayInSeconds = 86400

const createExchange = async function (factory: any, tokenAddress: any, sender: any) {
  const exchangeAddress = await factory
    .connect(sender)
    .callStatic.createExchange(tokenAddress)

  await factory.connect(sender).createExchange(tokenAddress)

  const Exchange = await ethers.getContractFactory("InternExchange")

  return await Exchange.attach(exchangeAddress)
}

describe("Factory with INT token", function () {
  let owner: any
  let user: any

  let dex: any
  let token: any
  let factory: any


  beforeEach(async function () {
    [owner, user] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory("InternFactory")
    factory = await Factory.deploy()

    const Token = await ethers.getContractFactory("Token")
    token = await Token.deploy("Token", "TKN", toWei(1000000))

    dex = await createExchange(factory, token.address, owner)
  })

  describe("create exchange", function () {
    it("is deployed", async function () {
      expect(await factory.deployed()).to.eq(factory)
      expect(await token.deployed()).to.eq(token)
      expect(await dex.deployed()).to.eq(dex)
    })

    it("deploys an exchange", async function () {
      const _dex = await createExchange(factory, factory.address, owner)

      expect(await _dex.deployed()).to.eq(_dex)

      expect(await _dex.name()).to.eq("InternSwap-V1")
      expect(await _dex.symbol()).to.eq("INTS-V1")
    })

    it("fails when enter zero address", async function () {
      await expect(
        factory
          .createExchange("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWith("invalid address!");
    })

    it("fails when exchange exists", async function () {
      await expect(factory.createExchange(token.address)).to.be.revertedWith(
        "exchange already exist!"
      );
    })

    it("should have an owner being whitelisted", async function () {
      expect(await factory.owner()).to.eq(factory.address)

      expect(await factory.addressWhitelistStatus(factory.address)).to.eq(true)
    })

    it("should have name 'Intern token' and symbol 'INT'", async function () {
      expect(await factory.name()).to.eq("Intern token")

      expect(await factory.symbol()).to.eq("INT")
    })
  })

  describe("getExchange", function () {
    it("returns exchange address", async function () {
      expect(await factory.getExchange(token.address))
        .to.eq(dex.address)
    })
  })

  describe("Mintable", function () {
    beforeEach(async function () {
      await token.approve(dex.address, toWei(100000))
      await dex.addLiquidity(toWei(100000), { value: toWei(100) })
    })

    it("can mint", async function () {
      await ethers.provider.send("evm_increaseTime", [dayInSeconds])

      const txWithdrawStaked = dex.withdrawStakedTokens()

      await expect(() => txWithdrawStaked)
        .to.changeTokenBalance(
          factory,
          owner.address,
          toWei("100")
        )
    })

    it("can't mint if not whitelisted", async function () {
      expect(await factory.addressWhitelistStatus(user.address))
        .to.eq(false)

      await expect(factory.connect(user).mint(user.address, 100))
        .to.be.revertedWith("you are not whitelisted!")
    })
  })

  describe("TotalTokenStatus Event", function () {
    it("can create minted tokens event", async function () {
      await token.approve(dex.address, toWei(100000))
      await dex.addLiquidity(toWei(100000), { value: toWei(100) })
      await ethers.provider.send("evm_increaseTime", [dayInSeconds])

      await expect(dex.withdrawStakedTokens())
        .to.emit(factory, "TotalTokenStatus")
        .withArgs(dex.address, owner.address, toWei(100), true)
    })
  })


  describe("Adding to whitelist", function () {
    it("can add to whitelist", async function () {
      const _dex = await createExchange(factory, factory.address, owner)
      expect(await _dex.deployed()).to.eq(_dex)

      expect(await factory.addressWhitelistStatus(_dex.address)).to.eq(true)
    })


    it("can't add if not whitelised", async function () {
      expect(await factory.addressWhitelistStatus(owner.address))
        .to.eq(false)

      await expect(factory.addToWhitelist(user.address))
        .to.be.revertedWith("you are not whitelisted!")
    })
  })

  describe("Total Token supply", function () {
    it("should have dynamic total token supply", async function () {
      await token.approve(dex.address, toWei(100000))
      await dex.addLiquidity(toWei(100000), { value: toWei(100) })

      expect(await factory.totalSupply()).to.eq(0)

      await ethers.provider.send("evm_increaseTime", [dayInSeconds])
      await dex.withdrawStakedTokens()

      expect(await factory.totalSupply()).to.eq(toWei(100))
    })
  })

  describe("Transfer", function () {
    beforeEach(async function () {
      await token.approve(dex.address, toWei(100000))
      await dex.addLiquidity(toWei(100000), { value: toWei(100) })

      await ethers.provider.send("evm_increaseTime", [dayInSeconds])
      await dex.withdrawStakedTokens()
    })

    it("can transfer tokens", async function () {
      const tx = await factory.transfer(user.address, toWei(10));

      await expect(() => tx)
        .to.changeTokenBalance(factory, user.address, toWei(10));
    })

    it("should have the same total supply after transfer", async function () {
      expect(await factory.totalSupply()).to.eq(toWei(100))

      await factory.transfer(user.address, toWei(10))

      expect(await factory.totalSupply()).to.eq(toWei(100))
    })

    it("can't transfer if not enough tokens", async function () {
      await expect(factory.transfer(user.address, toWei(150)))
        .to.be.revertedWith("not enough tokens!")
    })
  })

  describe("Transfer From", function () {
    beforeEach(async function () {
      await token.approve(dex.address, toWei(100000))
      await dex.addLiquidity(toWei(100000), { value: toWei(100) })

      await ethers.provider.send("evm_increaseTime", [dayInSeconds])
      await dex.withdrawStakedTokens()
    })

    it("can transfer from address with approval and allowance", async function () {
      await factory.approve(user.address, toWei(10));

      const tx = await factory.connect(user)
        .transferFrom(owner.address, user.address, toWei(10));

      await expect(() => tx)
        .to.changeTokenBalance(factory, user.address, toWei(10));

      expect(await factory.allowance(owner.address, user.address))
        .to.eq(0);
    })

    it("can't transfer from address without approval and allowance", async function () {
      await expect(factory.connect(user).transferFrom(owner.address, user.address, toWei(10)))
        .to.be.revertedWith("check allowance!")
    })

    it("can't transfer more tokens than it was approved", async function () {
      await factory.approve(user.address, toWei(10));

      await expect(factory.connect(user).transferFrom(owner.address, user.address, toWei(20)))
        .to.be.revertedWith("check allowance!")
    })

    it("can't transfer if it is not enough tokens", async function () {
      expect(await factory.balanceOf(owner.address)).to.eq(toWei(100))

      await factory.approve(user.address, toWei(150));

      await expect(factory.connect(user).transferFrom(owner.address, user.address, toWei(150)))
        .to.be.revertedWith("not enough tokens!")
    })
  })


  describe("Transfer, Approve Events", function () {
    beforeEach(async function () {
      await token.approve(dex.address, toWei(100000))
      await dex.addLiquidity(toWei(100000), { value: toWei(100) })

      await ethers.provider.send("evm_increaseTime", [dayInSeconds])
      await dex.withdrawStakedTokens()
    })

    it("can create transfer event", async function () {
      await expect(factory.transfer(user.address, toWei(10)))
        .to.emit(factory, "Transfer")
        .withArgs(owner.address, user.address, toWei(10))
    })

    it("can create approve event", async function () {
      await expect(factory.approve(user.address, toWei(10)))
        .to.emit(factory, "Approve")
        .withArgs(owner.address, user.address, toWei(10))
    })
  })

  describe("Transfer, Approve Events", function () {
    it("should have decimals = 18", async function () {
      expect(await factory.decimals()).to.eq("18")
    })
  })
})