![Duniter logo](https://git.duniter.org/nodes/typescript/duniter/raw/dev/images/250%C3%97250.png)

# Duniter [![build status](https://git.duniter.org/nodes/typescript/duniter/badges/dev/pipeline.svg)](https://git.duniter.org/nodes/typescript/duniter/commits/dev) [![Coverage Status](https://coveralls.io/repos/github/duniter/duniter/badge.svg?branch=master)](https://coveralls.io/github/duniter/duniter?branch=master) [![Dependencies](https://david-dm.org/duniter/duniter.svg)](https://david-dm.org/duniter/duniter) [![Minimum rustc version](https://img.shields.io/badge/rustc-1.47.0+-yellow.svg)](https://github.com/rust-lang/rust/blob/master/RELEASES.md)

Duniter (previously uCoin) is a libre software allowing to create a new kind of P2P crypto-currencies based on individuals and Universal Dividend.

Inspired by [Bitcoin](https://github.com/bitcoin/bitcoin) and [OpenUDC](https://github.com/Open-UDC/open-udc) projects.

<p align="center"><img src="https://git.duniter.org/nodes/typescript/duniter/raw/dev/images/duniter_admin_g1.png" /></p>

## Development state

[Ğ1, first libre currency for production using Duniter have been launched March 8th 2017](https://en.duniter.org/g1-go/).

However, we are running simultaneously a testing currency.

### Add your node to the network

See [Install a node documentation](https://duniter.org/en/wiki/duniter/install/).

### Clients, wallets, GUI, Web-UI, Mobile-App

See [duniter.org](https://duniter.org/) or for end user [monnaie-libre.fr](https://monnaie-libre.fr/)

## Going further

### Contribute

- See [CONTRIBUTING](./CONTRIBUTING.md).
- [Guide (fr)](./doc/dev/contribute-french.md)

#### In a post-it

```bash
git clone https://git.duniter.org/nodes/typescript/duniter.git
cd duniter
cargo xtask build
./target/release/duniter start
```

### Documentation

Visit [Duniter website](https://duniter.org): it gathers theoretical informations, FAQ and several useful links. If you want to learn, this is the first place to visit.

For technical documentation, refer to the `doc` folder of this git repository.

### Talk about/get involved in Duniter project

If you wish to participate/debate on Duniter, you can:

- visit [Duniter Forum](https://forum.duniter.org)
- join [XMPP chatroom](https://chat.duniter.org) [xmpp://duniter@muc.duniter.org](xmpp://duniter@muc.duniter.org)
- contact us directly at [contact@duniter.org](mailto:contact@duniter.org)
- subscribe to [a mailing list for Duniter node's administrators](https://listes.aquilenet.fr/sympa/subscribe/duniter-node-admins)

### Developement

Duniter is currently migrating from [Typescript] to [Rust].
This migration is being done gradually via a [NodeJs]<->[Rust] binding provided by [Neon].
The fact of migrating from code to [Rust] is commonly called "oxidation", so we speak of "Duniter's oxidation".

The long-term goal is to oxidize Duniter entirely, but it is a long process that will take several years.

Duniter's code is divided into several git repositories:

- **[dubp-rs-libs]** contains the logic common to Duniter and its clients.
- **[duniter-core]** contains the core code of Duniter.
- The gitlab subgroup **[nodes/rust/modules]** contains the main Duniter modules code (gva, admin, etc).
- **[duniter]** repository contains the "official" implementations of the "duniter-cli" and "duniter-desktop" programs with their default modules (also contains the historical implementation being migrated).

Old optional repositories (will be archived when the migration is complete):

- [**Web admin**](https://git.duniter.org/nodes/typescript/modules/duniter-ui): web administration interface (optional).
- [Currency monit](https://git.duniter.org/nodes/typescript/modules/duniter-currency-monit): charts to monitor currency and web of trust state.
- [Remuniter](https://github.com/duniter/remuniter): service to remunerate blocks issuers.

# References

## Theoretical

- [(en) Relative theory of money](http://en.trm.creationmonetaire.info)
- [(fr) Théorie relative de la monnaie](http://trm.creationmonetaire.info)

## OpenUDC

- [OpenUDC repository](https://github.com/Open-UDC/open-udc)
- [Other project trying to implement OpenUDC in python](https://github.com/canercandan/django-openudc)

# License

This software is distributed under [GNU AGPLv3](https://git.duniter.org/nodes/typescript/duniter/blob/dev/LICENSE).

[Neon]: https://neon-bindings.com/
[NodeJs]: https://nodejs.org/en/
[Rust]: https://www.rust-lang.org/
[Typescript]: https://www.typescriptlang.org/
