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
use dubp::common::prelude::*;

pub(super) async fn exec_req_last_blockstamp_out_of_fork_window(
    bca_executor: &BcaExecutor,
) -> Result<BcaRespTypeV0, ExecReqTypeError> {
    if let Some(current_block_number) = bca_executor
        .cm_accessor
        .get_current_meta(|cm| cm.current_block_meta.number)
        .await
    {
        let dbs_reader = bca_executor.dbs_reader();
        bca_executor
            .dbs_pool
            .execute(move |dbs| {
                let block_ref_number = if current_block_number < 101 {
                    0
                } else {
                    current_block_number - 101
                };
                let block_ref_hash = dbs_reader
                    .block(&dbs.bc_db_ro, U32BE(block_ref_number))?
                    .expect("unreachable")
                    .hash;
                Ok::<_, ExecReqTypeError>(BcaRespTypeV0::LastBlockstampOutOfForkWindow(
                    Blockstamp {
                        number: BlockNumber(block_ref_number),
                        hash: BlockHash(block_ref_hash),
                    },
                ))
            })
            .await?
    } else {
        Err("no blockchain".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::*;

    #[tokio::test]
    async fn test_exec_req_last_blockstamp_out_of_fork_window_no_blockchain() {
        let mut cm_mock = MockAsyncAccessor::new();
        cm_mock
            .expect_get_current_meta::<u32>()
            .times(1)
            .returning(|_| None);
        let dbs_reader = MockDbsReader::new();
        let bca_executor =
            create_bca_executor(cm_mock, dbs_reader).expect("fail to create bca executor");

        let resp_res = exec_req_last_blockstamp_out_of_fork_window(&bca_executor).await;

        assert_eq!(resp_res, Err(ExecReqTypeError("no blockchain".into())));
    }

    #[tokio::test]
    async fn test_exec_req_last_blockstamp_out_of_fork_window_ok() -> Result<(), ExecReqTypeError> {
        let mut cm_mock = MockAsyncAccessor::new();
        cm_mock
            .expect_get_current_meta::<u32>()
            .times(1)
            .returning(|f| Some(f(&CurrentMeta::default())));
        let mut dbs_reader = MockDbsReader::new();
        dbs_reader
            .expect_block()
            .times(1)
            .returning(|_, _| Ok(Some(BlockMetaV2::default())));

        let bca_executor =
            create_bca_executor(cm_mock, dbs_reader).expect("fail to create bca executor");

        let resp = exec_req_last_blockstamp_out_of_fork_window(&bca_executor).await?;

        assert_eq!(
            resp,
            BcaRespTypeV0::LastBlockstampOutOfForkWindow(Blockstamp::default())
        );

        Ok(())
    }
}
