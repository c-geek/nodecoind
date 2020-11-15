//  Copyright (C) 2020 Éloïs SANCHEZ.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

use crate::*;
use duniter_dbs::{
    bc_v2::{IdentitiesEvent, UdsEvent, UdsRevalEvent},
    UdIdV2,
};

pub(crate) fn create_uds<B: Backend>(
    block_number: BlockNumber,
    dividend: SourceAmount,
    identities: &mut TxColRw<B::Col, IdentitiesEvent>,
    uds: &mut TxColRw<B::Col, UdsEvent>,
    uds_reval: &mut TxColRw<B::Col, UdsRevalEvent>,
) -> KvResult<()> {
    let previous_ud_amount = uds_reval
        .iter(.., |it| it.reverse().values().next_res())?
        .unwrap_or_else(|| SourceAmountValV2(SourceAmount::ZERO));
    if dividend > previous_ud_amount.0 {
        uds_reval.upsert(U32BE(block_number.0), SourceAmountValV2(dividend));
    }

    let members = identities.iter(.., |it| {
        it.filter_map_ok(|(pk, idty)| if idty.member { Some(pk.0) } else { None })
            .collect::<KvResult<Vec<_>>>()
    })?;
    for member in members {
        uds.upsert(UdIdV2(member, block_number), ());
    }
    Ok(())
}

pub(crate) fn revert_uds<B: Backend>(
    block_number: BlockNumber,
    identities: &mut TxColRw<B::Col, IdentitiesEvent>,
    uds: &mut TxColRw<B::Col, UdsEvent>,
    uds_reval: &mut TxColRw<B::Col, UdsRevalEvent>,
) -> KvResult<()> {
    let previous_reval_block_number = uds_reval
        .iter(.., |it| it.reverse().keys().next_res())?
        .expect("corrupted db")
        .0;
    if block_number.0 == previous_reval_block_number {
        uds_reval.remove(U32BE(block_number.0));
    }

    let members = identities.iter(.., |it| {
        it.filter_map_ok(|(pk, idty)| if idty.member { Some(pk.0) } else { None })
            .collect::<KvResult<Vec<_>>>()
    })?;
    for member in members {
        uds.remove(UdIdV2(member, block_number));
    }

    Ok(())
}
