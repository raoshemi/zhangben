import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography } from 'antd';
import api from '../api/client';

export default function Dashboard() {
  const [bookCount, setBookCount] = useState(0);
  const [accountCount, setAccountCount] = useState(0);
  const [voucherCount, setVoucherCount] = useState(0);

  useEffect(() => {
    api
      .get('/books')
      .then(({ data }) => {
        setBookCount(data.length);
        if (data.length) {
          api
            .get('/accounts', { params: { bookId: data[0].id } })
            .then((r) => setAccountCount(r.data.length))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <Typography.Title level={4}>仪表盘</Typography.Title>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic title="账套数量" value={bookCount} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="会计科目数（默认账套）" value={accountCount} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="凭证数量" value={voucherCount} />
          </Card>
        </Col>
      </Row>
      <Typography.Paragraph style={{ marginTop: 24 }} type="secondary">
        账本记账系统：符合国内会计制度，支持企业会计准则与小企业会计准则，功能覆盖记账、查询与财务报表（不含进销存）。
      </Typography.Paragraph>
    </div>
  );
}
