# CHANGELOG

## v1.9.0 (XX XXXX 2020)

## v1.8.0: (12th March 2020)

### Highlights

- Migrate to Nodejs v10
- Oxidation (=Migration to Rust) beginning via Neon binding:
  - Migrate C/C++ modules: `wotb` and `naclb`

### Security

- Update or remove security vulnerable dependencies @librelois

### Features

- Migrate `naclb` to rust implementation `dup-crypto-rs` @librelois
- Migrate `wotb` to rust implementation `dubp-wot` @librelois
- #1373: Support for Nodejs v10 @c-geek @Moul
- Abstracting conf DAL to ConfDAO @c-geek
- Remove ArchiveDAO, which is a LokiJS artifact @c-geek
- Add to an interface ServerDAO methods that could be used by external modules @c-geek
- StatsDAL => replaced by LevelDB indexes @c-geek
- Add `--nocheck-issuer` option to `gen-*` commands @c-geek

### Fixes

- In case of wrong network configuration, Duniter could crash on startup @c-geek
- `/branches` should not throw if current block does not exist @c-geek

### Refactoring

- Almost complete rewriting of the prover module @librelois
- #1372: `scryptb` dependency removal @c-geek

### CI

- #1405: Add a Makefile to bare build Duniter  @sveyret.
- Generate Duniter container from the CI/CD @librelois
- g1 and gt control hashes have changed to add `replayable_on` @c-geek

### Documentation

- Import of [website documentation](https://duniter.org/en/wiki/duniter/) @librelois
- `doc/` directory restructuration @librelois
- Obsolete documentation removal @librelois
- Document `network/ws2p/heads` BMA path @vtexier
- Document `wot/requirements-of-pending/<minsig>` BMA path @vtexier

Thanks @librelois, @c-geek, @sveyret, @Moul, @vtexier

## v1.7.21: (12th Feb 2020)

- #1394: Former member back in the WoT with only 4 certifiers

@c-geek

## v1.7.20: (28th Jan 2020)

- #1396: CINDEX revert removes certifications
- #1390: Duniter uses a buggy version of TweetNaCl

@c-geek
@librelois

## v1.7.19: (28th May 2019)

- #1379: prevent expired membership documents to reach the mempool
- #1380: prevent expired certifications to reach the mempool

@c-geek

## v1.7.18: (2nd May 2019)

### Code

- [La Ğ1-test est bloquée au bloc n°362834.](https://forum.duniter.org/t/g1-test-dans-les-choux/4192/318)

Thanks @Moul, @c-geek, @jytou

## v1.7.17 (28th April 2019)

### CI/CD

- Fix artifactory process: move to a minimalist jinja2 Docker image
- Trigger integration stages pipeline only when code changes
- Set releases:x64 artifacts to expire after six months

### Code

- [Duniter v1.7.17 : règle de distance non respectée](https://forum.duniter.org/t/duniter-v1-7-17-regle-de-distance-non-respectee/6057)
- Add `sync-mempool-fwd` command
- Add `dump wot` command
- #1358: Remove Loki related code
- #1356: Remove non-used code getting membership status
- !1269: Add more feedback on BMA interface configuration

#### Other

- Upgrade outdated dependencies: morgan, seedrandom, socks-proxy, and tail
- Update README.md
- Add initial CHANGELOG.md for releases from v1.7.15

Thanks @Moul, @c-geek, @Tuxicoman

## v1.7.16 (6th April 2019)

**Hotfix release for Ğ1**

- [Duniter v1.7.16 : Bug à l’ajout d’une certification d’un non membre dans le bloc à calculer](https://forum.duniter.org/t/duniter-v1-7-16-bug-a-l-ajout-d-une-certification-d-un-non-membre-dans-le-bloc-a-calculer/5952/96)
- Add variable type

Thanks @Moul, @c-geek, @jytou

## v1.7.15 (4th April 2019)

**Hotfix /tx/history/<pubkey> broken since 1.7 release**

- #1350, !1276: Time of transactions not being saved on SQLite table
- Integration tests for transaction history and transaction history with times filters
- dump-ww: use file copy + semaphore to trigger the copy

Thanks @bpresles, @c-geek

## v1.7.14 (29th March 2019)

- … To be completed
